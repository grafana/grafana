import { renderHook } from '@testing-library/react';

import { DataSourceSettings } from '@grafana/data';

import { SQLOptions } from '../../types';

import { useMigrateDatabaseFields } from './useMigrateDatabaseFields';

jest.mock('@grafana/runtime', () => {
  return {
    config: {
      sqlConnectionLimits: {
        maxOpenConns: 10,
        maxIdleConns: 11,
        connMaxLifetime: 12,
      },
    },
    logDebug: jest.fn(),
    createMonitoringLogger: jest.fn().mockReturnValue({
      logDebug: jest.fn(),
    }),
  };
});

describe('Database Field Migration', () => {
  let defaultProps = {
    options: {
      database: 'testDatabase',
      id: 1,
      uid: 'unique-id',
      orgId: 1,
      name: 'Datasource Name',
      type: 'postgres',
      typeName: 'Postgres',
      typeLogoUrl: 'http://example.com/logo.png',
      access: 'access',
      url: 'http://example.com',
      user: 'user',
      basicAuth: true,
      basicAuthUser: 'user',
      isDefault: false,
      secureJsonFields: {},
      readOnly: false,
      withCredentials: false,
      jsonData: {
        tlsAuth: false,
        tlsAuthWithCACert: false,
        timezone: 'America/Chicago',
        tlsSkipVerify: false,
        user: 'user',
      },
    },
  };
  it('should migrate the old database field to be included in jsonData', () => {
    const props = {
      ...defaultProps,
      onOptionsChange: (options: DataSourceSettings) => {
        const jsonData = options.jsonData as SQLOptions;
        expect(options.database).toBe('');
        expect(jsonData.database).toBe('testDatabase');
      },
    };

    // @ts-ignore Ignore this line as it's expected that
    // the database object will not be in necessary (most current) state
    const { rerender, result } = renderHook(() => useMigrateDatabaseFields(props));
    rerender();
  });

  it('adds default max connection, max idle connection, and auto idle values when not detected', () => {
    const props = {
      ...defaultProps,
      onOptionsChange: (options: DataSourceSettings) => {
        const jsonData = options.jsonData as SQLOptions;
        expect(jsonData.maxOpenConns).toBe(10);
        expect(jsonData.maxIdleConns).toBe(11);
        expect(jsonData.connMaxLifetime).toBe(12);
        expect(jsonData.maxIdleConnsAuto).toBe(true);
      },
    };

    // @ts-ignore Ignore this line as it's expected that
    // the database object will not be in the expected (most current) state
    const { rerender, result } = renderHook(() => useMigrateDatabaseFields(props));
    rerender();
  });
});
