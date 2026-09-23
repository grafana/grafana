import { type ExceptionEvent, LogLevel, type TransportItem, TransportItemType } from '@grafana/faro-core';

import { addPluginChunkErrorContext } from './pluginChunkErrorContext';

const PLUGIN_CHUNK_URL = 'https://plugins-cdn.grafana.net/my-app/1.0.0/public/plugins/my-app/156.js?_cache=abc';
const CORE_CHUNK_URL = 'http://localhost:3000/public/build/156.1234567890abcdef.js';

function exceptionItem(payload: Partial<ExceptionEvent>): TransportItem<ExceptionEvent> {
  return {
    type: TransportItemType.EXCEPTION,
    payload: { timestamp: '2026-09-23T00:00:00Z', type: 'Error', value: '', ...payload },
    meta: {},
  };
}

function chunkLoadErrorItem(chunkErrorType: string, url: string, context?: Record<string, string>) {
  return exceptionItem({
    type: 'ChunkLoadError',
    value: `Loading chunk 156 failed.\n(${chunkErrorType}: ${url})`,
    context,
  });
}

describe('addPluginChunkErrorContext', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('adds the plugin id and chunk details to a plugin chunk load error', () => {
    jest.spyOn(performance, 'getEntriesByName').mockReturnValue([]);
    const item = chunkLoadErrorItem('error', PLUGIN_CHUNK_URL, { type: 'boundary', source: 'unknown' });

    const result = addPluginChunkErrorContext(item);

    expect(result.payload).toMatchObject({
      context: {
        type: 'boundary',
        source: 'unknown',
        pluginId: 'my-app',
        errorType: 'chunk-load',
        chunkErrorType: 'error',
        failedUrl: PLUGIN_CHUNK_URL,
        httpStatusSource: 'none',
      },
    });
  });

  it('adds the http status when resource timing has one', () => {
    const entries = [{ name: PLUGIN_CHUNK_URL, entryType: 'resource', responseStatus: 404 }];
    jest.spyOn(performance, 'getEntriesByName').mockReturnValue(entries as unknown as PerformanceEntryList);

    const result = addPluginChunkErrorContext(chunkLoadErrorItem('error', PLUGIN_CHUNK_URL));

    expect(result.payload).toMatchObject({
      context: { httpStatus: '404', httpStatusSource: 'resource-timing' },
    });
  });

  it.each`
    description                          | item
    ${'a core Grafana chunk load error'} | ${chunkLoadErrorItem('error', CORE_CHUNK_URL)}
    ${'another type of exception'}       | ${exceptionItem({ type: 'TypeError', value: `(error: ${PLUGIN_CHUNK_URL})` })}
    ${'a chunk error without a url'}     | ${exceptionItem({ type: 'ChunkLoadError', value: 'Loading chunk 156 failed.' })}
  `('leaves $description unchanged', ({ item }) => {
    const original = structuredClone(item);

    expect(addPluginChunkErrorContext(item)).toEqual(original);
  });

  it('leaves items that are not exceptions unchanged', () => {
    const item: TransportItem = {
      type: TransportItemType.LOG,
      payload: {
        timestamp: '2026-09-23T00:00:00Z',
        level: LogLevel.ERROR,
        message: `(error: ${PLUGIN_CHUNK_URL})`,
        context: {},
      },
      meta: {},
    };
    const original = structuredClone(item);

    expect(addPluginChunkErrorContext(item)).toEqual(original);
  });
});
