import { lastValueFrom } from 'rxjs';

import { SQLQuery } from '@grafana/sql';
import config from 'app/core/config';

import InfluxDatasource from './datasource';
import {
  getMockDSInstanceSettings,
  mockBackendService,
  mockInfluxQueryRequest,
  mockInfluxSQLFetchResponse,
  mockTemplateSrv,
} from './mocks';
import { InfluxVersion } from './types';

config.featureToggles.influxdbBackendMigration = true;
mockBackendService(mockInfluxSQLFetchResponse);

describe('InfluxDB SQL Support', () => {
  const replaceMock = jest.fn();
  const templateSrv = mockTemplateSrv(jest.fn(), replaceMock);

  let sqlQuery: SQLQuery;

  beforeEach(() => {
    sqlQuery = {
      refId: 'x',
      rawSql:
        'SELECT "$interpolationVar2", time FROM iox.$interpolationVar WHERE time >= $__timeFrom AND time <= $__timeTo',
    };
  });

  describe('interpolate variables', () => {
    const ds = new InfluxDatasource(getMockDSInstanceSettings({ version: InfluxVersion.SQL }), templateSrv);

    it('should call replace template variables for rawSql', async () => {
      await lastValueFrom(ds.query(mockInfluxQueryRequest([sqlQuery])));
      expect(replaceMock.mock.calls[1][0]).toBe(
        `SELECT "$interpolationVar2", time FROM iox.$interpolationVar WHERE time >= $__timeFrom AND time <= $__timeTo`
      );
    });
  });
});
