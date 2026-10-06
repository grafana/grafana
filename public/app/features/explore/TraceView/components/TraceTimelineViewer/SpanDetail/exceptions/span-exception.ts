import { type TraceKeyValuePair, type TraceLog } from '@grafana/data';

import { type TraceSpan } from '../../../types/trace';

export type SpanException = {
  type?: string;
  message?: string;
  stacktrace?: string;
};

const EXCEPTION_TYPE_KEYS = ['exception.type', 'exception_type'];
const EXCEPTION_MESSAGE_KEYS = ['exception.message', 'exception_message'];
const EXCEPTION_STACKTRACE_KEYS = ['exception.stacktrace', 'exception.stack_trace', 'exception_stacktrace'];

function getPairValue(pairs: TraceKeyValuePair[] | undefined, keys: string[]): string | undefined {
  if (!pairs?.length) {
    return undefined;
  }

  for (const key of keys) {
    const match = pairs.find((pair) => pair.key === key);
    if (match?.value != null) {
      const value = String(match.value).trim();
      if (value !== '') {
        return value;
      }
    }
  }

  return undefined;
}

function isExceptionAttributeKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return normalized.startsWith('exception.') || normalized.startsWith('exception_');
}

function isExceptionLog(log: TraceLog): boolean {
  if (log.name?.toLowerCase() === 'exception') {
    return true;
  }

  return Boolean(log.fields?.some((field) => isExceptionAttributeKey(field.key)));
}

function getExceptionFields(pairs: TraceKeyValuePair[] | undefined): SpanException {
  const type = getPairValue(pairs, EXCEPTION_TYPE_KEYS);
  const message = getPairValue(pairs, EXCEPTION_MESSAGE_KEYS);
  const stacktrace = getPairValue(pairs, EXCEPTION_STACKTRACE_KEYS);

  return {
    ...(type && { type }),
    ...(message && { message }),
    ...(stacktrace && { stacktrace }),
  };
}

/**
 * Reads exception type, message, and stacktrace from span events, tags, or the
 * Jaeger `stackTraces` field. Later exception events win over earlier ones.
 */
export function getSpanException(span: TraceSpan): SpanException | undefined {
  let exception: SpanException = getExceptionFields(span.tags);

  const exceptionLogs = (span.logs ?? []).filter(isExceptionLog).sort((a, b) => a.timestamp - b.timestamp);
  for (const log of exceptionLogs) {
    exception = { ...exception, ...getExceptionFields(log.fields) };
  }

  if (!exception.stacktrace && span.stackTraces?.length) {
    exception = { ...exception, stacktrace: span.stackTraces.join('\n\n') };
  }

  if (!exception.type && !exception.message && !exception.stacktrace) {
    return undefined;
  }

  return exception;
}
