import { DataSourceInstanceSettings } from '@grafana/data';

import { DB, SQLOptions, SqlQueryModel } from '../types';
import { makeVariable } from '../utils/testHelpers';

import { SqlDatasource } from './SqlDatasource';

// Minimal test implementation of SqlDatasource
class TestSqlDatasource extends SqlDatasource {
  getDB(): DB {
    return {} as DB;
  }

  getQueryModel(): SqlQueryModel {
    return {
      quoteLiteral: (value: string) => `'${value.replace(/'/g, "''")}'`,
    } as SqlQueryModel;
  }
}

describe('SqlDatasource - Variable Interpolation', () => {
  const instanceSettings = {
    jsonData: {
      defaultProject: 'testproject',
    },
  } as unknown as DataSourceInstanceSettings<SQLOptions>;

  let ds: TestSqlDatasource;

  beforeEach(() => {
    ds = new TestSqlDatasource(instanceSettings);
  });

  describe('Case 1: Multi-value enabled, single value selected', () => {
    it('should escape single quotes in string value', () => {
      const variable = makeVariable('id1', 'name1', { multi: true });
      // When we apply the general fix for all SQL data sources these should be uncommented
      // expect(ds.interpolateVariable('value1', variable)).toEqual('value1');
      // expect(ds.interpolateVariable("O'Brien", variable)).toEqual("O''Brien");
      expect(ds.interpolateVariable('value1', variable)).toEqual(`'value1'`);
      expect(ds.interpolateVariable("O'Brien", variable)).toEqual(`'O''Brien'`);
    });

    it('should handle numeric value', () => {
      const variable = makeVariable('id1', 'name1', { multi: true });
      expect(ds.interpolateVariable(42 as unknown as string, variable)).toEqual(42);
    });
  });

  describe('Case 2: Multi-value enabled, multiple values selected', () => {
    it('should return quoted, comma-separated values', () => {
      const variable = makeVariable('id1', 'name1', { multi: true });
      expect(ds.interpolateVariable(['value1', 'value2', 'value3'], variable)).toEqual("'value1','value2','value3'");
    });

    it('should escape single quotes in array values', () => {
      const variable = makeVariable('id1', 'name1', { multi: true });
      expect(ds.interpolateVariable(["O'Brien", 'Smith', "D'Angelo"], variable)).toEqual(
        "'O''Brien','Smith','D''Angelo'"
      );
    });

    it('should handle empty array', () => {
      const variable = makeVariable('id1', 'name1', { multi: true });
      expect(ds.interpolateVariable([], variable)).toEqual('');
    });
  });

  describe('Case 3: Include all enabled, single value selected', () => {
    it('should escape single quotes in string value', () => {
      const variable = makeVariable('id1', 'name1', { includeAll: true });
      // When we apply the general fix for all SQL data sources these should be uncommented
      // expect(ds.interpolateVariable('value1', variable)).toEqual('value1');
      // expect(ds.interpolateVariable("O'Brien", variable)).toEqual("O''Brien");
      expect(ds.interpolateVariable('value1', variable)).toEqual(`'value1'`);
      expect(ds.interpolateVariable("O'Brien", variable)).toEqual(`'O''Brien'`);
    });

    it('should handle numeric value', () => {
      const variable = makeVariable('id1', 'name1', { includeAll: true });
      expect(ds.interpolateVariable(123 as unknown as string, variable)).toEqual(123);
    });
  });

  describe('Case 4: Include all enabled, "All" value selected', () => {
    it('should handle All option as array', () => {
      const variable = makeVariable('id1', 'name1', { includeAll: true });
      expect(ds.interpolateVariable(['value1', 'value2', 'value3'], variable)).toEqual("'value1','value2','value3'");
    });

    it('should handle All option with special characters', () => {
      const variable = makeVariable('id1', 'name1', { includeAll: true });
      expect(ds.interpolateVariable(["test'1", 'test2', "test'3"], variable)).toEqual("'test''1','test2','test''3'");
    });
  });

  describe('Case 5: No include all, no multi-value, single value selected', () => {
    it('should escape single quotes in string value', () => {
      const variable = makeVariable('id1', 'name1', { multi: false, includeAll: false });
      expect(ds.interpolateVariable('value1', variable)).toEqual('value1');
      expect(ds.interpolateVariable("O'Brien", variable)).toEqual("O''Brien");
    });

    it('should handle numeric value', () => {
      const variable = makeVariable('id1', 'name1', { multi: false, includeAll: false });
      expect(ds.interpolateVariable(999 as unknown as string, variable)).toEqual(999);
    });

    it('should handle empty string', () => {
      const variable = makeVariable('id1', 'name1', { multi: false, includeAll: false });
      expect(ds.interpolateVariable('', variable)).toEqual('');
    });
  });

  describe('Case 6: Both include all and multi-value enabled, single value selected', () => {
    it('should escape single quotes in string value', () => {
      const variable = makeVariable('id1', 'name1', { multi: true, includeAll: true });
      // When we apply the general fix for all SQL data sources these should be uncommented
      // expect(ds.interpolateVariable('value1', variable)).toEqual('value1');
      // expect(ds.interpolateVariable("O'Brien", variable)).toEqual("O''Brien");
      expect(ds.interpolateVariable('value1', variable)).toEqual(`'value1'`);
      expect(ds.interpolateVariable("O'Brien", variable)).toEqual(`'O''Brien'`);
    });

    it('should handle numeric value', () => {
      const variable = makeVariable('id1', 'name1', { multi: true, includeAll: true });
      expect(ds.interpolateVariable(456 as unknown as string, variable)).toEqual(456);
    });
  });

  describe('Case 7: Both include all and multi-value enabled, "All" value selected', () => {
    it('should handle All option as array', () => {
      const variable = makeVariable('id1', 'name1', { multi: true, includeAll: true });
      expect(ds.interpolateVariable(['value1', 'value2', 'value3'], variable)).toEqual("'value1','value2','value3'");
    });

    it('should handle All option with mixed values', () => {
      const variable = makeVariable('id1', 'name1', { multi: true, includeAll: true });
      expect(ds.interpolateVariable(['alpha', 'beta', 'gamma'], variable)).toEqual("'alpha','beta','gamma'");
    });

    it('should handle All option with special characters', () => {
      const variable = makeVariable('id1', 'name1', { multi: true, includeAll: true });
      expect(ds.interpolateVariable(["it's", "can't", "won't"], variable)).toEqual("'it''s','can''t','won''t'");
    });
  });

  describe('Case 8: Both include all and multi-value enabled, multiple values selected', () => {
    it('should return quoted, comma-separated values', () => {
      const variable = makeVariable('id1', 'name1', { multi: true, includeAll: true });
      expect(ds.interpolateVariable(['value1', 'value2'], variable)).toEqual("'value1','value2'");
    });

    it('should escape single quotes in array values', () => {
      const variable = makeVariable('id1', 'name1', { multi: true, includeAll: true });
      expect(ds.interpolateVariable(["O'Brien", "D'Angelo"], variable)).toEqual("'O''Brien','D''Angelo'");
    });

    it('should handle single item array', () => {
      const variable = makeVariable('id1', 'name1', { multi: true, includeAll: true });
      expect(ds.interpolateVariable(['value1'], variable)).toEqual("'value1'");
    });

    it('should handle array with single quote escaping', () => {
      const variable = makeVariable('id1', 'name1', { multi: true, includeAll: true });
      expect(ds.interpolateVariable(['a', "b'c", 'd'], variable)).toEqual("'a','b''c','d'");
    });
  });
});
