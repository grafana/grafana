import {
  classifyPluginLoadError,
  extractPluginIdFromUrl,
  getResourceStatus,
  PluginAssetFetchError,
  PluginLoadError,
} from './pluginLoadError';

const CDN_MODULE_URL =
  'https://plugins-cdn.grafana.net/grafana-clock-panel/3.2.4/public/plugins/grafana-clock-panel/module.js';
const SYSTEMJS_DOCS = 'https://github.com/systemjs/systemjs/blob/main/docs/errors.md';

function systemJSError(code: number, message: string) {
  return new Error(`${message} (SystemJS Error#${code} ${SYSTEMJS_DOCS}#${code})`);
}

function chunkLoadError(type: string, url: string) {
  const error = new Error(`Loading chunk 156 failed.\n(${type}: ${url})`);
  return Object.assign(error, { name: 'ChunkLoadError', type, request: url });
}

function mockResourceEntries(entries: Array<Partial<PerformanceResourceTiming>>) {
  return jest.spyOn(performance, 'getEntriesByName').mockReturnValue(
    entries.map((entry) => ({
      name: CDN_MODULE_URL,
      entryType: 'resource',
      ...entry,
    })) as unknown as PerformanceEntryList
  );
}

describe('getResourceStatus', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the status of the last entry for the url when it is an error status', () => {
    mockResourceEntries([{ responseStatus: 200 }, { responseStatus: 404 }]);

    expect(getResourceStatus(CDN_MODULE_URL)).toBe(404);
  });

  it.each`
    description                               | entries
    ${'the status is 0 (network failure)'}    | ${[{ responseStatus: 0 }]}
    ${'the status is a success'}              | ${[{ responseStatus: 200 }]}
    ${'there is no entry for the url'}        | ${[]}
    ${'the browser does not record a status'} | ${[{}]}
  `('returns undefined when $description', ({ entries }) => {
    mockResourceEntries(entries);

    expect(getResourceStatus(CDN_MODULE_URL)).toBeUndefined();
  });

  it('looks up resource entries by url', () => {
    const getEntriesByName = mockResourceEntries([]);

    getResourceStatus(CDN_MODULE_URL);

    expect(getEntriesByName).toHaveBeenCalledWith(CDN_MODULE_URL, 'resource');
  });
});

describe('extractPluginIdFromUrl', () => {
  it.each`
    url                                                                     | expected
    ${CDN_MODULE_URL}                                                       | ${'grafana-clock-panel'}
    ${'http://localhost:3000/public/plugins/my-app/156.js?_cache=abc'}      | ${'my-app'}
    ${'public/plugins/my-app/module.js'}                                    | ${'my-app'}
    ${'http://localhost:3000/public/app/plugins/datasource/loki/module.js'} | ${'loki'}
    ${'http://localhost:3000/public/build/rspack/app.1234567890abcdef.js'}  | ${undefined}
    ${'https://example.com/some/other/file.js'}                             | ${undefined}
  `('returns $expected for $url', ({ url, expected }) => {
    expect(extractPluginIdFromUrl(url)).toBe(expected);
  });
});

describe('classifyPluginLoadError', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('classifies a fetch error with a status as http, using the response status', () => {
    const error = new PluginAssetFetchError(CDN_MODULE_URL, 404, 'Not Found');

    expect(classifyPluginLoadError(error)).toEqual({
      errorType: 'http',
      httpStatus: 404,
      httpStatusSource: 'response',
      failedUrl: CDN_MODULE_URL,
    });
  });

  it('classifies a fetch error without a status as network', () => {
    const error = new PluginAssetFetchError(CDN_MODULE_URL, undefined, undefined, {
      cause: new TypeError('Failed to fetch'),
    });

    expect(classifyPluginLoadError(error)).toEqual({
      errorType: 'network',
      httpStatusSource: 'none',
      failedUrl: CDN_MODULE_URL,
    });
  });

  it('classifies a script load failure as http when resource timing has an error status', () => {
    mockResourceEntries([{ responseStatus: 404 }]);
    const error = systemJSError(3, `Error loading ${CDN_MODULE_URL} from http://localhost:3000/`);

    expect(classifyPluginLoadError(error)).toEqual({
      errorType: 'http',
      httpStatus: 404,
      httpStatusSource: 'resource-timing',
      failedUrl: CDN_MODULE_URL,
    });
  });

  it('classifies a script load failure as load-failed when no status can be found', () => {
    mockResourceEntries([{ responseStatus: 0 }]);
    const error = systemJSError(3, `Error loading ${CDN_MODULE_URL}`);

    expect(classifyPluginLoadError(error)).toEqual({
      errorType: 'load-failed',
      httpStatusSource: 'none',
      failedUrl: CDN_MODULE_URL,
    });
  });

  it('classifies a chunk load error as chunk-load, with the status from resource timing', () => {
    const chunkUrl = CDN_MODULE_URL.replace('module.js', '156.js');
    mockResourceEntries([{ responseStatus: 404 }]);

    expect(classifyPluginLoadError(chunkLoadError('error', chunkUrl))).toEqual({
      errorType: 'chunk-load',
      httpStatus: 404,
      httpStatusSource: 'resource-timing',
      failedUrl: chunkUrl,
      chunkErrorType: 'error',
    });
  });

  it('classifies a chunk load error without a status as chunk-load', () => {
    const chunkUrl = CDN_MODULE_URL.replace('module.js', '156.js');
    mockResourceEntries([]);

    expect(classifyPluginLoadError(chunkLoadError('missing', chunkUrl))).toEqual({
      errorType: 'chunk-load',
      httpStatusSource: 'none',
      failedUrl: chunkUrl,
      chunkErrorType: 'missing',
    });
  });

  it('classifies a wrong content type as invalid-module', () => {
    const error = systemJSError(4, `Unknown Content-Type "text/html", loading ${CDN_MODULE_URL}`);

    expect(classifyPluginLoadError(error)).toEqual({
      errorType: 'invalid-module',
      httpStatusSource: 'none',
      failedUrl: CDN_MODULE_URL,
    });
  });

  it('reads the status from a SystemJS fetch error message', () => {
    const error = systemJSError(7, `404 , loading app/plugins/sdk from ${CDN_MODULE_URL}`);

    expect(classifyPluginLoadError(error)).toEqual({
      errorType: 'http',
      httpStatus: 404,
      httpStatusSource: 'message',
      failedUrl: 'app/plugins/sdk',
    });
  });

  it('classifies any other error as evaluation', () => {
    expect(classifyPluginLoadError(new TypeError("Cannot read properties of undefined (reading 'x')"))).toEqual({
      errorType: 'evaluation',
      httpStatusSource: 'none',
    });
  });

  it('classifies a thrown value that is not an Error as unknown', () => {
    expect(classifyPluginLoadError('boom')).toEqual({
      errorType: 'unknown',
      httpStatusSource: 'none',
    });
  });
});

describe('PluginLoadError', () => {
  it('keeps the message and cause, and exposes the classification', () => {
    const cause = new PluginAssetFetchError(CDN_MODULE_URL, 404, 'Not Found');

    const error = new PluginLoadError('Could not load plugin', {
      cause,
      errorType: 'http',
      httpStatus: 404,
      httpStatusSource: 'response',
      failedUrl: CDN_MODULE_URL,
    });

    expect(error.message).toBe('Could not load plugin');
    expect(error.cause).toBe(cause);
    expect(error.errorType).toBe('http');
    expect(error.httpStatus).toBe(404);
    expect(error.httpStatusSource).toBe('response');
    expect(error.failedUrl).toBe(CDN_MODULE_URL);
  });
});
