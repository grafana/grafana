import { of } from 'rxjs';

import { AppEvents } from '@grafana/data';
import { logWarning } from '@grafana/runtime';

import { initialCustomVariableModelState } from '../mocks/variables';

import {
  fetchAllArmResources,
  fetchArmResourcePage,
  hasOption,
  interpolateVariable,
  parseNextLinkToken,
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

function mockFetchResponse<T>(value: T[], headers: Record<string, string> = {}) {
  return of({
    data: { value },
    headers: { get: (key: string) => headers[key] ?? null },
  });
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

describe('AzureMonitor: fetchArmResourcePage', () => {
  beforeEach(() => {
    fetchMock.mockClear();
  });

  it('requests the backend resource endpoint with the given params', async () => {
    fetchMock.mockReturnValue(mockFetchResponse([{ id: 1 }, { id: 2 }]));

    const page = await fetchArmResourcePage<{ id: number }>('abc', 'subscriptions', { listAll: 'true' });

    expect(fetchMock).toHaveBeenCalledWith({
      url: '/api/datasources/uid/abc/resources/subscriptions',
      params: { listAll: 'true' },
      method: 'GET',
    });
    expect(page.value).toEqual([{ id: 1 }, { id: 2 }]);
    expect(page.nextToken).toBeUndefined();
    expect(page.truncated).toBe(false);
  });

  it('surfaces the continuation token from the Link header', async () => {
    fetchMock.mockReturnValue(mockFetchResponse([{ id: 1 }], { Link: '<?nextToken=page2>; rel="next"' }));

    const page = await fetchArmResourcePage<{ id: number }>('abc', 'subscriptions', { listAll: 'false' });

    expect(page.value).toEqual([{ id: 1 }]);
    expect(page.nextToken).toBe('page2');
  });

  it('flags truncation from the X-Results-Truncated header', async () => {
    fetchMock.mockReturnValue(mockFetchResponse([{ id: 1 }], { 'X-Results-Truncated': 'true' }));

    const page = await fetchArmResourcePage<{ id: number }>('abc', 'subscriptions', { listAll: 'true' });

    expect(page.truncated).toBe(true);
  });
});

describe('AzureMonitor: fetchAllArmResources', () => {
  beforeEach(() => {
    fetchMock.mockClear();
    publish.mockClear();
  });

  it('requests eager listing and returns the value array', async () => {
    fetchMock.mockReturnValue(mockFetchResponse([{ id: 1 }, { id: 2 }]));

    const value = await fetchAllArmResources<{ id: number }>('abc', 'workspaces', { subscriptionId: 'sub-1' });

    expect(fetchMock).toHaveBeenCalledWith({
      url: '/api/datasources/uid/abc/resources/workspaces',
      params: { subscriptionId: 'sub-1', listAll: 'true' },
      method: 'GET',
    });
    expect(value).toEqual([{ id: 1 }, { id: 2 }]);
    expect(publish).not.toHaveBeenCalled();
  });

  it('warns when the backend truncated the listing', async () => {
    fetchMock.mockReturnValue(mockFetchResponse([{ id: 1 }], { 'X-Results-Truncated': 'true' }));

    await fetchAllArmResources<{ id: number }>('abc', 'subscriptions');

    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ type: AppEvents.alertWarning.name }));
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
