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
  jsonData: TestJsonData;
  expected: boolean;
};

describe('qscheck', () => {
  const testCases: TestCase[] = [
    {
      name: 'empty jsondata',
      jsonData: {},
      expected: true,
    },
    {
      name: 'no oauth',
      jsonData: {
        thing1: 'http://localhost:9090',
        thing2: 15,
      },
      expected: true,
    },
    {
      name: 'oauth false',
      jsonData: {
        thing1: 'http://localhost:9090',
        thing2: 42,
        oauthPassThru: false,
      },
      expected: true,
    },
    {
      name: 'oauth true',
      jsonData: {
        thing1: 'http://localhost:9090',
        thing2: 55,
        oauthPassThru: true,
      },
      expected: false,
    },
    {
      name: 'oauth non-boolean',
      jsonData: {
        thing1: 'http://localhost:9090',
        thing2: 77,
        oauthPassThru: 42,
      },
      expected: false,
    },
    {
      name: 'azureoauth missing',
      jsonData: {
        thing1: 'http://localhost:9090',
        thing2: 77,
        // azureCredentials not there
      },
      expected: true,
    },
    {
      name: 'azureoauth different auth',
      jsonData: {
        thing1: 'http://localhost:9090',
        thing2: 77,
        azureCredentials: {
          authType: 'workloadidentity',
        },
      },
      expected: true,
    },
    {
      name: 'azureoauth currentuser auth',
      jsonData: {
        thing1: 'http://localhost:9090',
        thing2: 77,
        azureCredentials: {
          authType: 'currentuser',
        },
      },
      expected: false,
    },
  ];

  testCases.forEach((t) => {
    test(t.name, () => {
      const settings: DataSourceInstanceSettings<TestJsonData> = {
        jsonData: t.jsonData,
        uid: 'uid1',
        type: 'prometheus',
        name: 'prom1',
        meta: {} as DataSourcePluginMeta,
        readOnly: false,
        access: 'proxy',
      };
      const result = isQueryServiceCompatible([settings]);
      expect(result).toBe(t.expected);
    });
  });
});
