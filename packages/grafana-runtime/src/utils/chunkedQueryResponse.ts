import { Observable } from 'rxjs';

import {
  type DataFrameJSON,
  dataFrameFromJSON,
  type DataQueryError,
  type DataQueryResponse,
  LoadingState,
} from '@grafana/data';

import { type FetchResponse } from '../services';

interface ChunkedQueryEvent {
  refId: string;
  frameId?: string;
  frame?: DataFrameJSON;
  error?: string;
  errorSource?: string;
}

function isDataFrameJSON(value: unknown): value is DataFrameJSON {
  return value !== null && typeof value === 'object' && 'schema' in value && 'data' in value;
}

function parseEvent(line: string): ChunkedQueryEvent {
  const value: unknown = JSON.parse(line);
  if (value === null || typeof value !== 'object' || !('refId' in value) || typeof value.refId !== 'string') {
    throw new Error('event is missing refId');
  }

  const event: ChunkedQueryEvent = { refId: value.refId };
  if ('frameId' in value && typeof value.frameId === 'string') {
    event.frameId = value.frameId;
  }
  if ('error' in value && typeof value.error === 'string') {
    event.error = value.error;
  }
  if ('errorSource' in value && typeof value.errorSource === 'string') {
    event.errorSource = value.errorSource;
  }
  if ('frame' in value && value.frame !== undefined) {
    if (!isDataFrameJSON(value.frame)) {
      throw new Error('event has an invalid frame');
    }
    event.frame = value.frame;
  }
  return event;
}

function toQueryError(event: ChunkedQueryEvent, response: FetchResponse<Uint8Array | undefined>): DataQueryError {
  return {
    refId: event.refId,
    message: event.error,
    status: response.status,
    statusText: response.statusText,
    traceId: response.traceId,
  };
}

function toResponseError(response: FetchResponse<Uint8Array | undefined>): DataQueryError {
  return {
    message: `Chunked query request failed with status ${response.status}: ${response.statusText}`,
    status: response.status,
    statusText: response.statusText,
    traceId: response.traceId,
  };
}

/**
 * Converts the datasource API's JSONL query response into incremental query
 * packets. Browser ReadableStream chunks are arbitrary byte sequences, so lines
 * are retained until their terminating newline has arrived.
 */
export function toChunkedDataQueryResponse(
  chunks: Observable<FetchResponse<Uint8Array | undefined>>
): Observable<DataQueryResponse> {
  return new Observable((subscriber) => {
    const decoder = new TextDecoder();
    let remainder = '';
    let packetCount = 0;

    const emitLine = (line: string, response: FetchResponse<Uint8Array | undefined>) => {
      if (line.trim().length === 0) {
        return;
      }

      let event: ChunkedQueryEvent;
      try {
        event = parseEvent(line);
      } catch {
        subscriber.error(new Error('Invalid JSONL event in chunked datasource query response'));
        return;
      }

      if (!event.refId) {
        subscriber.error(new Error('Chunked datasource query response event is missing refId'));
        return;
      }

      // frameId is part of the chunked datasource response contract and identifies
      // a complete frame within one refId. Reusing it replaces a repeated frame
      // rather than retaining another copy in the query runner.
      const key = event.frameId
        ? `chunked-query-${event.refId}-${event.frameId}`
        : `chunked-query-${event.refId}-${packetCount++}`;
      if (event.error) {
        const error = toQueryError(event, response);
        subscriber.next({ key, data: [], error, errors: [error], state: LoadingState.Error });
        return;
      }

      if (event.frame) {
        const frame = dataFrameFromJSON(event.frame);
        frame.refId ??= event.refId;
        subscriber.next({
          key,
          data: [frame],
          state: LoadingState.Streaming,
          traceIds: response.traceId ? [response.traceId] : undefined,
        });
      }
    };

    const subscription = chunks.subscribe({
      next: (response) => {
        if (!response.ok) {
          subscriber.error(toResponseError(response));
          return;
        }
        if (!response.data) {
          return;
        }

        remainder += decoder.decode(response.data, { stream: true });
        const lines = remainder.split('\n');
        remainder = lines.pop() ?? '';
        for (const line of lines) {
          emitLine(line, response);
        }
      },
      error: (error) => subscriber.error(error),
      complete: () => {
        remainder += decoder.decode();
        if (remainder.trim().length > 0) {
          subscriber.error(new Error('Chunked datasource query response ended with an incomplete JSONL event'));
          return;
        }
        subscriber.next({ key: 'chunked-query-complete', data: [], state: LoadingState.Done });
        subscriber.complete();
      },
    });

    return () => subscription.unsubscribe();
  });
}
