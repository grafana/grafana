import { DataSourceInstanceSettings } from '@grafana/data';
import { DatasourceSrv } from './datasource_srv';

describe('DatasourceSrv', () => {
  const consoleWarn = console.warn;
  beforeEach(() => {
    console.warn = jest.fn();
  });
  afterEach(() => {
    console.warn = consoleWarn;
  });

  describe('getDataSourceSettingsByUid', () => {
    [
      {
        name: 'should return the datasource settings for a valid UID',
        uid: 'my-datasource-uid',
        storedSettings: {
          'my-datasource-uid': {
            uid: 'my-datasource-uid',
          } as DataSourceInstanceSettings,
        },
        expectedSettings: {
          uid: 'my-datasource-uid',
        } as DataSourceInstanceSettings,
      },
      {
        name: 'should return the datasource settings for fixed UID',
        uid: 'my/datasource/uid',
        storedSettings: {
          'my-datasource-uid': {
            uid: 'my-datasource-uid',
          } as DataSourceInstanceSettings,
        },
        expectedSettings: {
          uid: 'my-datasource-uid',
        } as DataSourceInstanceSettings,
      },
    ].forEach((scenario) => {
      it(scenario.name, () => {
        const datasourceSrv = new DatasourceSrv();
        datasourceSrv.init(scenario.storedSettings, '');
        const result = datasourceSrv.getDataSourceSettingsByUid(scenario.uid);
        expect(result).toEqual(scenario.expectedSettings);
      });
    });
  });
});
