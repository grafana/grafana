import { firstValueFrom, from } from 'rxjs';
import { toArray } from 'rxjs/operators';

import { type DataFrameJSON, FieldType, LoadingState } from '@grafana/data';

import { type FetchResponse } from '../services';

import { toChunkedDataQueryResponse } from './chunkedQueryResponse';

const encoder = new TextEncoder();

function response(data: string): FetchResponse<Uint8Array> {
  return {
    data: encoder.encode(data),
    status: 200,
    statusText: 'OK',
    ok: true,
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '/query',
    config: { url: '/query' },
  };
}

const frame: DataFrameJSON = {
  schema: { fields: [{ name: 'value', type: FieldType.number }] },
  data: { values: [[42]] },
};

describe('toChunkedDataQueryResponse', () => {
  it('buffers partial JSONL lines and emits a streaming frame response', async () => {
    const event = JSON.stringify({ refId: 'A', frameId: '0', frame }) + '\n';
    const splitAt = 13;

    const responses = await firstValueFrom(
      toChunkedDataQueryResponse(from([response(event.slice(0, splitAt)), response(event.slice(splitAt))])).pipe(
        toArray()
      )
    );

    expect(responses).toHaveLength(2);
    expect(responses[0]).toMatchObject({ key: 'chunked-query-A-0', state: LoadingState.Streaming });
    expect(responses[0].data[0].refId).toBe('A');
    expect(responses[0].data[0].fields[0].values).toEqual([42]);
    expect(responses[1]).toEqual({ key: 'chunked-query-complete', data: [], state: LoadingState.Done });
  });

  it('emits every event from one network chunk separately', async () => {
    const events = `${JSON.stringify({ refId: 'A', frame })}\n${JSON.stringify({ refId: 'B', error: 'query failed' })}\n`;

    const responses = await firstValueFrom(toChunkedDataQueryResponse(from([response(events)])).pipe(toArray()));

    expect(responses).toHaveLength(3);
    expect(responses[0].data[0].refId).toBe('A');
    expect(responses[1]).toMatchObject({
      key: 'chunked-query-B-1',
      state: LoadingState.Error,
      error: { refId: 'B', message: 'query failed', status: 200 },
    });
  });

  it('fails when the stream ends with an incomplete JSONL event', async () => {
    await expect(firstValueFrom(toChunkedDataQueryResponse(from([response('{"refId":"A"}')])))).rejects.toThrow(
      'incomplete JSONL event'
    );
  });
});
