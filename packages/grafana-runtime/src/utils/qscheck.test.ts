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
  jsonDatas: TestJsonData[];
  expected: boolean;
};

describe('qscheck', () => {
  const testCases: TestCase[] = [
    {
      name: 'no queries',
      jsonDatas: [],
      expected: true,
    },
    {
      name: 'empty jsondata',
      jsonDatas: [{}],
      expected: true,
    },
    {
      name: 'no oauth',
      jsonDatas: [
        {
          thing1: 'http://localhost:9090',
          thing2: 15,
        },
      ],
      expected: true,
    },
    {
      name: 'oauth false',
      jsonDatas: [
        {
          thing1: 'http://localhost:9090',
          thing2: 42,
          oauthPassThru: false,
        },
      ],
      expected: true,
    },
    {
      name: 'oauth true',
      jsonDatas: [
        {
          thing1: 'http://localhost:9090',
          thing2: 55,
          oauthPassThru: true,
        },
      ],
      expected: false,
    },
    {
      name: 'oauth non-boolean',
      jsonDatas: [
        {
          thing1: 'http://localhost:9090',
          thing2: 77,
          oauthPassThru: 42,
        },
      ],
      expected: false,
    },
    {
      name: 'azureoauth missing',
      jsonDatas: [
        {
          thing1: 'http://localhost:9090',
          thing2: 77,
          // azureCredentials not there
        },
      ],
      expected: true,
    },
    {
      name: 'azureoauth different auth',
      jsonDatas: [
        {
          thing1: 'http://localhost:9090',
          thing2: 77,
          azureCredentials: {
            authType: 'workloadidentity',
          },
        },
      ],
      expected: true,
    },
    {
      name: 'azureoauth currentuser auth',
      jsonDatas: [
        {
          thing1: 'http://localhost:9090',
          thing2: 77,
          azureCredentials: {
            authType: 'currentuser',
          },
        },
      ],
      expected: false,
    },
    {
      name: 'one good one bad',
      jsonDatas: [
        {
          thing1: 'http://localhost:9090',
          thing2: 15,
        },
        {
          thing1: 'http://localhost:9090',
          thing2: 77,
          oauthPassThru: true,
        },
      ],
      expected: false,
    },
  ];

  testCases.forEach((t) => {
    test(t.name, () => {
      const settings: Array<DataSourceInstanceSettings<TestJsonData>> = t.jsonDatas.map((jsonData) => ({
        jsonData: jsonData,
        uid: 'uid1',
        type: 'prometheus',
        name: 'prom1',
        meta: {} as DataSourcePluginMeta,
        readOnly: false,
        access: 'proxy',
      }));

      const result = isQueryServiceCompatible(settings);
      expect(result).toBe(t.expected);
    });
  });
});
