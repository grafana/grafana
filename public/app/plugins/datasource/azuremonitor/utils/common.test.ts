import { of } from 'rxjs';

import { AppEvents } from '@grafana/data';
import { config, logWarning } from '@grafana/runtime';

import { initialCustomVariableModelState } from '../mocks/variables';

import {
  fetchAllArmResources,
  fetchArmResourcePage,
  hasOption,
  interpolateVariable,
  nextLinkToPath,
  parseNextLinkToken,
  skipTokenFromNextLink,
  warnResultsTruncated,
} from './common';

const publish = jest.fn();
const fetchMock = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  logWarning: jest.fn(),
  getAppEvents: jest.fn(() => ({ publish })),
  getBackendSrv: jest.fn(() => ({ fetch: fetchMock })),
}));

const setServerSidePagination = (enabled: boolean) => {
  (config.featureToggles as Record<string, boolean | undefined>).azureMonitorServerSidePagination = enabled;
};

// Flag ON: normalized body + Link/X-Results-Truncated headers.
function onPageResponse<T>(value: T[], headers: Record<string, string> = {}) {
  return of({ data: { value }, headers: new Headers(headers) });
}

// Flag OFF: raw ARM body carrying nextLink, no Link header.
function offPageResponse<T>(value: T[], nextLink?: string) {
  return of({ data: { value, nextLink } });
}

describe('AzureMonitor: hasOption', () => {
  it('can find an option in flat array', () => {
    const options = [
      { value: 'a', label: 'a' },
      { value: 'b', label: 'b' },
      { value: 'c', label: 'c' },
    ];

    expect(hasOption(options, 'b')).toBeTruthy();
  });

  it('can not find an option in flat array', () => {
    const options = [
      { value: 'a', label: 'a' },
      { value: 'b', label: 'b' },
      { value: 'c', label: 'c' },
    ];

    expect(hasOption(options, 'not-there')).not.toBeTruthy();
  });

  it('can find an option in a nested group', () => {
    const options = [
      { value: 'a', label: 'a' },
      { value: 'b', label: 'b' },
      {
        label: 'c',
        value: 'c',
        options: [
          { value: 'c-a', label: 'c-a' },
          { value: 'c-b', label: 'c-b' },
          { value: 'c-c', label: 'c-c' },
        ],
      },
      { value: 'd', label: 'd' },
    ];

    expect(hasOption(options, 'c-b')).toBeTruthy();
  });
});

describe('AzureMonitor: parseNextLinkToken', () => {
  it('extracts the nextToken from a Link: rel="next" header', () => {
    expect(parseNextLinkToken('<?nextToken=page2>; rel="next"')).toBe('page2');
  });

  it('extracts the nextToken alongside other params', () => {
    expect(parseNextLinkToken('<?nextToken=page2&subscriptionId=sub-1>; rel="next"')).toBe('page2');
  });

  it('returns undefined when the header does not match', () => {
    expect(parseNextLinkToken('garbage')).toBeUndefined();
  });

  it('returns undefined when there is no nextToken param', () => {
    expect(parseNextLinkToken('<?subscriptionId=sub-1>; rel="next"')).toBeUndefined();
  });
});

describe('AzureMonitor: skipTokenFromNextLink', () => {
  it('extracts the $skiptoken from a raw ARM nextLink', () => {
    expect(
      skipTokenFromNextLink('https://management.azure.com/subscriptions?api-version=2019-03-01&$skiptoken=tok2')
    ).toBe('tok2');
  });

  it('returns undefined when there is no nextLink or no $skiptoken', () => {
    expect(skipTokenFromNextLink(undefined)).toBeUndefined();
    expect(skipTokenFromNextLink('https://management.azure.com/subscriptions?api-version=2019-03-01')).toBeUndefined();
    expect(skipTokenFromNextLink('not-a-url')).toBeUndefined();
  });
});

describe('AzureMonitor: nextLinkToPath', () => {
  it('rewrites a raw ARM nextLink onto the passthrough prefix, keeping path + query', () => {
    expect(
      nextLinkToPath(
        '/api/datasources/uid/abc/resources/azuremonitor',
        'https://management.azure.com/subscriptions?api-version=2019-03-01&$skiptoken=tok2'
      )
    ).toBe('/api/datasources/uid/abc/resources/azuremonitor/subscriptions?api-version=2019-03-01&$skiptoken=tok2');
  });
});

describe('AzureMonitor: fetchArmResourcePage (server-side pagination ON)', () => {
  beforeEach(() => {
    fetchMock.mockClear();
    setServerSidePagination(true);
  });

  afterEach(() => {
    setServerSidePagination(false);
  });

  it('requests the passthrough resource path forwarding listAll', async () => {
    fetchMock.mockReturnValue(onPageResponse([{ id: 1 }, { id: 2 }]));

    const page = await fetchArmResourcePage<{ id: number }>('abc', 'subscriptions', { listAll: 'true' });

    expect(fetchMock).toHaveBeenCalledWith({
      url: '/api/datasources/uid/abc/resources/azuremonitor/subscriptions?api-version=2019-03-01&listAll=true',
      method: 'GET',
    });
    expect(page.value).toEqual([{ id: 1 }, { id: 2 }]);
    expect(page.nextToken).toBeUndefined();
    expect(page.truncated).toBe(false);
  });

  it('interpolates the subscriptionId into the workspaces path (not as a query param)', async () => {
    fetchMock.mockReturnValue(onPageResponse([{ id: 1 }]));

    await fetchArmResourcePage<{ id: number }>('abc', 'workspaces', { subscriptionId: 'sub-1', listAll: 'false' });

    expect(fetchMock).toHaveBeenCalledWith({
      url: '/api/datasources/uid/abc/resources/azuremonitor/subscriptions/sub-1/providers/Microsoft.OperationalInsights/workspaces?api-version=2017-04-26-preview&listAll=false',
      method: 'GET',
    });
  });

  it('surfaces the continuation token from the Link header and forwards nextToken', async () => {
    fetchMock.mockReturnValue(onPageResponse([{ id: 1 }], { Link: '<?nextToken=page2>; rel="next"' }));

    const page = await fetchArmResourcePage<{ id: number }>('abc', 'subscriptions', {
      listAll: 'false',
      nextToken: 'page1',
    });

    expect(fetchMock.mock.calls[0][0].url).toContain('&listAll=false');
    expect(fetchMock.mock.calls[0][0].url).toContain('&nextToken=page1');
    expect(page.value).toEqual([{ id: 1 }]);
    expect(page.nextToken).toBe('page2');
  });

  it('flags truncation from the X-Results-Truncated header', async () => {
    fetchMock.mockReturnValue(onPageResponse([{ id: 1 }], { 'X-Results-Truncated': 'true' }));

    const page = await fetchArmResourcePage<{ id: number }>('abc', 'subscriptions', { listAll: 'true' });

    expect(page.truncated).toBe(true);
  });
});

describe('AzureMonitor: fetchArmResourcePage (server-side pagination OFF)', () => {
  beforeEach(() => {
    fetchMock.mockClear();
    setServerSidePagination(false);
  });

  it('requests the passthrough path without listAll/nextToken and reads the body', async () => {
    fetchMock.mockReturnValue(offPageResponse([{ id: 1 }, { id: 2 }]));

    const page = await fetchArmResourcePage<{ id: number }>('abc', 'subscriptions', { listAll: 'true' });

    expect(fetchMock).toHaveBeenCalledWith({
      url: '/api/datasources/uid/abc/resources/azuremonitor/subscriptions?api-version=2019-03-01',
      method: 'GET',
    });
    expect(page.value).toEqual([{ id: 1 }, { id: 2 }]);
    expect(page.nextToken).toBeUndefined();
    expect(page.truncated).toBe(false);
  });

  it('derives the continuation token from the body nextLink $skiptoken', async () => {
    fetchMock.mockReturnValue(
      offPageResponse([{ id: 1 }], 'https://management.azure.com/subscriptions?api-version=2019-03-01&$skiptoken=tok2')
    );

    const page = await fetchArmResourcePage<{ id: number }>('abc', 'subscriptions', { listAll: 'false' });

    expect(page.nextToken).toBe('tok2');
  });

  it('forwards a prior nextToken to ARM as $skiptoken', async () => {
    fetchMock.mockReturnValue(offPageResponse([{ id: 1 }]));

    await fetchArmResourcePage<{ id: number }>('abc', 'subscriptions', { listAll: 'false', nextToken: 'tok2' });

    expect(fetchMock.mock.calls[0][0].url).toContain('&$skiptoken=tok2');
    expect(fetchMock.mock.calls[0][0].url).not.toContain('listAll');
    expect(fetchMock.mock.calls[0][0].url).not.toContain('nextToken=');
  });
});

describe('AzureMonitor: fetchAllArmResources (server-side pagination ON)', () => {
  beforeEach(() => {
    fetchMock.mockClear();
    publish.mockClear();
    setServerSidePagination(true);
  });

  afterEach(() => {
    setServerSidePagination(false);
  });

  it('requests eager listing on the passthrough path and returns the value array', async () => {
    fetchMock.mockReturnValue(onPageResponse([{ id: 1 }, { id: 2 }]));

    const value = await fetchAllArmResources<{ id: number }>('abc', 'workspaces', { subscriptionId: 'sub-1' });

    expect(fetchMock).toHaveBeenCalledWith({
      url: '/api/datasources/uid/abc/resources/azuremonitor/subscriptions/sub-1/providers/Microsoft.OperationalInsights/workspaces?api-version=2017-04-26-preview&listAll=true',
      method: 'GET',
    });
    expect(value).toEqual([{ id: 1 }, { id: 2 }]);
    expect(publish).not.toHaveBeenCalled();
  });

  it('warns when the backend truncated the listing', async () => {
    fetchMock.mockReturnValue(onPageResponse([{ id: 1 }], { 'X-Results-Truncated': 'true' }));

    await fetchAllArmResources<{ id: number }>('abc', 'subscriptions');

    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ type: AppEvents.alertWarning.name }));
  });
});

describe('AzureMonitor: fetchAllArmResources (server-side pagination OFF)', () => {
  beforeEach(() => {
    fetchMock.mockClear();
    publish.mockClear();
    setServerSidePagination(false);
  });

  it('follows the raw ARM nextLink across pages, rewriting it onto the passthrough path', async () => {
    fetchMock
      .mockReturnValueOnce(
        offPageResponse(
          [{ id: 1 }],
          'https://management.azure.com/subscriptions?api-version=2019-03-01&$skiptoken=tok2'
        )
      )
      .mockReturnValueOnce(offPageResponse([{ id: 2 }]));

    const value = await fetchAllArmResources<{ id: number }>('abc', 'subscriptions');

    expect(value).toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0].url).toBe(
      '/api/datasources/uid/abc/resources/azuremonitor/subscriptions?api-version=2019-03-01'
    );
    expect(fetchMock.mock.calls[1][0].url).toBe(
      '/api/datasources/uid/abc/resources/azuremonitor/subscriptions?api-version=2019-03-01&$skiptoken=tok2'
    );
    expect(publish).not.toHaveBeenCalled();
  });
});

describe('AzureMonitor: warnResultsTruncated', () => {
  beforeEach(() => {
    jest.mocked(logWarning).mockClear();
    publish.mockClear();
  });

  it('logs and publishes an alert-warning app event', () => {
    warnResultsTruncated();

    expect(logWarning).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ type: AppEvents.alertWarning.name }));
  });
});

describe('When interpolating variables', () => {
  describe('and value is a string', () => {
    it('should return an unquoted value', () => {
      expect(interpolateVariable('abc', initialCustomVariableModelState)).toEqual('abc');
    });
  });

  describe('and value is a number', () => {
    it('should return an unquoted value', () => {
      expect(interpolateVariable(1000, initialCustomVariableModelState)).toEqual(1000);
    });
  });

  describe('and value is an array of strings', () => {
    it('should return comma separated quoted values', () => {
      expect(interpolateVariable(['a', 'b', 'c'], initialCustomVariableModelState)).toEqual("'a','b','c'");
    });
  });

  describe('and variable allows multi-value and value is a string', () => {
    it('should return a quoted value', () => {
      const variable = { ...initialCustomVariableModelState, multi: true };
      expect(interpolateVariable('abc', variable)).toEqual("'abc'");
    });
  });

  describe('and variable contains single quote', () => {
    it('should return a quoted value', () => {
      const variable = { ...initialCustomVariableModelState, multi: true };
      expect(interpolateVariable("a'bc", variable)).toEqual("'a'bc'");
    });
  });

  describe('and variable allows all and value is a string', () => {
    it('should return a quoted value', () => {
      const variable = { ...initialCustomVariableModelState, includeAll: true };
      expect(interpolateVariable('abc', variable)).toEqual("'abc'");
    });

    it('should not return a quoted value if the all value is modified', () => {
      const variable = { ...initialCustomVariableModelState, includeAll: true, allValue: 'All' };
      expect(interpolateVariable('abc', variable)).toEqual('abc');
    });

    it('should return a quoted value if multi is selected even if the allValue is set', () => {
      const variable = { ...initialCustomVariableModelState, includeAll: true, multi: true, allValue: 'All' };
      expect(interpolateVariable('abc', variable)).toEqual("'abc'");
    });
  });
});
