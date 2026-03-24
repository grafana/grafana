import { DataSourceInstanceSettings, DataSourcePluginMeta, DataSourceJsonData } from '@grafana/data';

import { isQueryServiceCompatible } from './qscheck';

interface TestJsonData extends DataSourceJsonData {
  oauthPassThru?: unknown;
  azureCredentials?: {
    authType?: unknown;
  };
  thing1?: string;
  thing2?: number;
}

type TestCase = {
  name: string;
  ds: Array<{
    jsonData: TestJsonData;
    type: string;
  }>;
  expected: boolean;
  flag: unknown;
  errorLogs: number;
};

describe('qscheck', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  const testCases: TestCase[] = [
    {
      name: 'no queries',
      ds: [],
      flag: { types: ['prometheus', 'loki'] },
      expected: true,
      errorLogs: 0,
    },
    {
      name: 'empty jsondata',
      ds: [
        {
          jsonData: {},
          type: 'prometheus',
        },
      ],
      flag: { types: ['prometheus', 'loki'] },
      expected: true,
      errorLogs: 0,
    },
    {
      name: 'no oauth',
      ds: [
        {
          jsonData: {
            thing1: 'http://localhost:9090',
            thing2: 15,
          },
          type: 'prometheus',
        },
      ],
      flag: { types: ['prometheus', 'loki'] },
      expected: true,
      errorLogs: 0,
    },
    {
      name: 'oauth false',
      ds: [
        {
          jsonData: {
            thing1: 'http://localhost:9090',
            thing2: 42,
            oauthPassThru: false,
          },
          type: 'prometheus',
        },
      ],
      flag: { types: ['prometheus', 'loki'] },
      expected: true,
      errorLogs: 0,
    },
    {
      name: 'oauth true',
      ds: [
        {
          jsonData: {
            thing1: 'http://localhost:9090',
            thing2: 55,
            oauthPassThru: true,
          },
          type: 'prometheus',
        },
      ],
      flag: { types: ['prometheus', 'loki'] },
      expected: false,
      errorLogs: 0,
    },
    {
      name: 'oauth non-boolean',
      ds: [
        {
          jsonData: {
            thing1: 'http://localhost:9090',
            thing2: 77,
            oauthPassThru: 42,
          },
          type: 'prometheus',
        },
      ],
      flag: { types: ['prometheus', 'loki'] },
      expected: false,
      errorLogs: 0,
    },
    {
      name: 'azureoauth missing',
      ds: [
        {
          jsonData: {
            thing1: 'http://localhost:9090',
            thing2: 77,
            // azureCredentials not there
          },
          type: 'prometheus',
        },
      ],
      flag: { types: ['prometheus', 'loki'] },
      expected: true,
      errorLogs: 0,
    },
    {
      name: 'azureoauth different auth',
      ds: [
        {
          jsonData: {
            thing1: 'http://localhost:9090',
            thing2: 77,
            azureCredentials: {
              authType: 'workloadidentity',
            },
          },
          type: 'prometheus',
        },
      ],
      flag: { types: ['prometheus', 'loki'] },
      expected: true,
      errorLogs: 0,
    },
    {
      name: 'azureoauth currentuser auth',
      ds: [
        {
          jsonData: {
            thing1: 'http://localhost:9090',
            thing2: 77,
            azureCredentials: {
              authType: 'currentuser',
            },
          },
          type: 'prometheus',
        },
      ],
      flag: { types: ['prometheus', 'loki'] },
      expected: false,
      errorLogs: 0,
    },
    {
      name: 'one good one bad',
      ds: [
        {
          jsonData: {
            thing1: 'http://localhost:9090',
            thing2: 15,
          },
          type: 'prometheus',
        },
        {
          jsonData: {
            thing1: 'http://localhost:9090',
            thing2: 77,
            oauthPassThru: true,
          },
          type: 'prometheus',
        },
      ],
      flag: { types: ['prometheus', 'loki'] },
      expected: false,
      errorLogs: 0,
    },
    {
      name: 'allowed-types empty',
      ds: [
        {
          jsonData: {
            thing2: 15,
          },
          type: 'prometheus',
        },
      ],
      flag: { types: [] },
      expected: false,
      errorLogs: 0,
    },
    {
      name: 'one allowed, one not',
      ds: [
        {
          jsonData: {
            thing2: 15,
          },
          type: 'prometheus',
        },
        {
          jsonData: {
            thing2: 77,
          },
          type: 'loki',
        },
      ],
      flag: { types: ['loki'] },
      expected: false,
      errorLogs: 0,
    },
    {
      name: 'one allowed',
      ds: [
        {
          jsonData: {
            thing2: 15,
          },
          type: 'prometheus',
        },
      ],
      flag: { types: ['prometheus', 'loki'] },
      expected: true,
      errorLogs: 0,
    },
    {
      name: 'two allowed',
      ds: [
        {
          jsonData: {
            thing2: 15,
          },
          type: 'prometheus',
        },
        {
          jsonData: {
            thing2: 17,
          },
          type: 'loki',
        },
      ],
      flag: { types: ['prometheus', 'loki'] },
      expected: true,
      errorLogs: 0,
    },
    {
      name: 'malformed flag: undefined',
      ds: [
        {
          jsonData: {},
          type: 'prometheus',
        },
      ],
      flag: undefined,
      expected: false,
      errorLogs: 1,
    },
    {
      name: 'malformed flag: empty object',
      ds: [
        {
          jsonData: {},
          type: 'prometheus',
        },
      ],
      flag: {},
      expected: false,
      errorLogs: 1,
    },
    {
      name: 'malformed flag: allowed non-string',
      ds: [
        {
          jsonData: {},
          type: 'prometheus',
        },
      ],
      flag: { types: ['prometheus', null] },
      expected: false,
      errorLogs: 1,
    },
    {
      name: 'incorrect flag: empty-string in allowed',
      ds: [
        {
          jsonData: {},
          type: 'prometheus',
        },
      ],
      flag: { types: ['', 'prometheus'] },
      expected: true,
      errorLogs: 0,
    },
  ];

  testCases.forEach((t) => {
    test(t.name, () => {
      const settings: Array<DataSourceInstanceSettings<TestJsonData>> = t.ds.map((ds) => ({
        jsonData: ds.jsonData,
        uid: 'uid1',
        type: ds.type,
        name: 'prom1',
        meta: {} as DataSourcePluginMeta,
        readOnly: false,
        access: 'proxy',
      }));

      const result = isQueryServiceCompatible(settings, t.flag);
      expect(result).toBe(t.expected);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(t.errorLogs);
    });
  });
});
