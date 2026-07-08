import { initialCustomVariableModelState } from '../mocks/variables';

import { fetchAllArmPages, hasOption, interpolateVariable, MAX_ARM_PAGES, nextLinkToPath } from './common';

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

describe('AzureMonitor: nextLinkToPath', () => {
  it('drops the ARM host and joins pathname + query onto the prefix', () => {
    const nextLink = 'https://management.azure.com/subscriptions?api-version=2019-03-01&$skiptoken=TOKEN';
    expect(nextLinkToPath('azuremonitor', nextLink)).toBe(
      'azuremonitor/subscriptions?api-version=2019-03-01&$skiptoken=TOKEN'
    );
  });

  it('works for a full resources base URL prefix and sovereign clouds', () => {
    const nextLink = 'https://management.usgovcloudapi.net/subscriptions?api-version=2019-03-01&$skiptoken=TOKEN';
    expect(nextLinkToPath('/api/datasources/1/resources/azuremonitor', nextLink)).toBe(
      '/api/datasources/1/resources/azuremonitor/subscriptions?api-version=2019-03-01&$skiptoken=TOKEN'
    );
  });
});

describe('AzureMonitor: fetchAllArmPages', () => {
  it('returns the single page when there is no nextLink', async () => {
    const fetchPage = jest.fn().mockResolvedValue({ value: [{ id: 1 }, { id: 2 }] });

    const results = await fetchAllArmPages('azuremonitor', 'azuremonitor/subscriptions?api-version=x', fetchPage);

    expect(results).toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith('azuremonitor/subscriptions?api-version=x');
  });

  it('follows nextLink across pages and rebuilds the path via the resource prefix', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce({
        value: [{ id: 1 }],
        nextLink: 'https://management.azure.com/subscriptions?api-version=x&$skiptoken=abc',
      })
      .mockResolvedValueOnce({ value: [{ id: 2 }] });

    const results = await fetchAllArmPages('azuremonitor', 'azuremonitor/subscriptions?api-version=x', fetchPage);

    expect(results).toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 'azuremonitor/subscriptions?api-version=x&$skiptoken=abc');
  });

  it('stops early and warns when a page returns no result', async () => {
    const fetchPage = jest.fn().mockResolvedValue(undefined);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const results = await fetchAllArmPages('azuremonitor', 'azuremonitor/subscriptions?api-version=x', fetchPage);

    expect(results).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('stops after MAX_ARM_PAGES even if nextLink never clears, and warns', async () => {
    const fetchPage = jest.fn().mockResolvedValue({
      value: [{ id: 1 }],
      nextLink: 'https://management.azure.com/subscriptions?api-version=x&$skiptoken=loop',
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const results = await fetchAllArmPages('azuremonitor', 'azuremonitor/subscriptions?api-version=x', fetchPage);

    expect(fetchPage).toHaveBeenCalledTimes(MAX_ARM_PAGES);
    expect(results).toHaveLength(MAX_ARM_PAGES);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
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
