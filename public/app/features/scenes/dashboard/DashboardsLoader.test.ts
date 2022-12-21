import { VariableType } from '@grafana/schema';

import { CustomVariable } from '../variables/variants/CustomVariable';
import { DataSourceVariable } from '../variables/variants/DataSourceVariable';
import { QueryVariable } from '../variables/variants/query/QueryVariable';

import { createVariableFromLegacyModel } from './DashboardsLoader';

describe('DashboardLoader', () => {
  describe('variables migration', () => {
    it('should migrate custom variable', () => {
      const variable = {
        current: {
          selected: false,
          text: 'a',
          value: 'a',
        },
        hide: 0,
        includeAll: false,
        multi: false,
        name: 'query0',
        options: [
          {
            selected: true,
            text: 'a',
            value: 'a',
          },
          {
            selected: false,
            text: 'b',
            value: 'b',
          },
          {
            selected: false,
            text: 'c',
            value: 'c',
          },
          {
            selected: false,
            text: 'd',
            value: 'd',
          },
        ],
        query: 'a,b,c,d',
        skipUrlSync: false,
        type: 'custom' as VariableType,
        rootStateKey: 'N4XLmH5Vz',
        id: 'query0',
        global: false,
        index: 0,
        state: 'Done',
        error: null,
        description: null,
        allValue: null,
      };

      const migrated = createVariableFromLegacyModel(variable);
      const { key, ...rest } = migrated.state;

      expect(migrated).toBeInstanceOf(CustomVariable);
      expect(rest).toEqual({
        allValue: undefined,
        defaultToAll: false,
        description: null,
        includeAll: false,
        isMulti: false,
        label: undefined,
        name: 'query0',
        options: [],
        query: 'a,b,c,d',
        skipUrlSync: false,
        text: 'a',
        type: 'custom',
        value: 'a',
        hide: 0,
      });
    });
    it('should migrate query variable', () => {
      const variable = {
        allValue: null,
        current: {
          text: 'America',
          value: 'America',
          selected: false,
        },
        datasource: {
          uid: 'P15396BDD62B2BE29',
          type: 'influxdb',
        },
        definition: '',
        hide: 0,
        includeAll: false,
        label: 'Datacenter',
        multi: false,
        name: 'datacenter',
        options: [
          {
            text: 'America',
            value: 'America',
            selected: true,
          },
          {
            text: 'Africa',
            value: 'Africa',
            selected: false,
          },
          {
            text: 'Asia',
            value: 'Asia',
            selected: false,
          },
          {
            text: 'Europe',
            value: 'Europe',
            selected: false,
          },
        ],
        query: 'SHOW TAG VALUES  WITH KEY = "datacenter" ',
        refresh: 1,
        regex: '',
        skipUrlSync: false,
        sort: 0,
        tagValuesQuery: null,
        tagsQuery: null,
        type: 'query' as VariableType,
        useTags: false,
        rootStateKey: '000000002',
        id: 'datacenter',
        global: false,
        index: 0,
        state: 'Done',
        error: null,
        description: null,
      };

      const migrated = createVariableFromLegacyModel(variable);
      const { key, ...rest } = migrated.state;

      expect(migrated).toBeInstanceOf(QueryVariable);
      expect(rest).toEqual({
        allValue: undefined,
        datasource: {
          type: 'influxdb',
          uid: 'P15396BDD62B2BE29',
        },
        defaultToAll: false,
        description: null,
        includeAll: false,
        isMulti: false,
        label: 'Datacenter',
        name: 'datacenter',
        options: [],
        query: 'SHOW TAG VALUES  WITH KEY = "datacenter" ',
        refresh: 1,
        regex: '',
        skipUrlSync: false,
        sort: 0,
        text: 'America',
        type: 'query',
        value: 'America',
        hide: 0,
      });
    });

    it('should migrate datasource variable', () => {
      const variable = {
        id: 'query1',
        rootStateKey: 'N4XLmH5Vz',
        name: 'query1',
        type: 'datasource' as VariableType,
        global: false,
        index: 1,
        hide: 0,
        skipUrlSync: false,
        state: 'Done',
        error: null,
        description: null,
        current: {
          value: ['gdev-prometheus', 'gdev-slow-prometheus'],
          text: ['gdev-prometheus', 'gdev-slow-prometheus'],
          selected: true,
        },
        regex: '/^gdev/',
        options: [
          {
            text: 'All',
            value: '$__all',
            selected: false,
          },
          {
            text: 'gdev-prometheus',
            value: 'gdev-prometheus',
            selected: true,
          },
          {
            text: 'gdev-slow-prometheus',
            value: 'gdev-slow-prometheus',
            selected: false,
          },
        ],
        query: 'prometheus',
        multi: true,
        includeAll: true,
        refresh: 1,
        allValue: 'Custom all',
      };

      const migrated = createVariableFromLegacyModel(variable);
      const { key, ...rest } = migrated.state;

      expect(migrated).toBeInstanceOf(DataSourceVariable);
      expect(rest).toEqual({
        allValue: 'Custom all',
        defaultToAll: true,
        includeAll: true,
        label: undefined,
        name: 'query1',
        options: [],
        query: 'prometheus',
        regex: '/^gdev/',
        skipUrlSync: false,
        text: ['gdev-prometheus', 'gdev-slow-prometheus'],
        type: 'datasource',
        value: ['gdev-prometheus', 'gdev-slow-prometheus'],
        isMulti: true,
        description: null,
        hide: 0,
      });
    });

    it('should migrate constant variable', () => {
      const variable = {
        hide: 2,
        label: 'constant',
        name: 'constant',
        skipUrlSync: false,
        type: 'constant',
        rootStateKey: 'N4XLmH5Vz',
        current: {
          selected: true,
          text: 'test',
          value: 'test',
        },
        options: [
          {
            selected: true,
            text: 'test',
            value: 'test',
          },
        ],
        query: 'test',
        id: 'constant',
        global: false,
        index: 3,
        state: 'Done',
        error: null,
        description: null,
      };

      const migrated = createVariableFromLegacyModel(variable);
      const { key, ...rest } = migrated.state;

      expect(rest).toEqual({
        description: null,
        hide: 2,
        label: 'constant',
        name: 'constant',
        skipUrlSync: false,
        type: 'constant',
        value: 'test',
      });
    });

    it.each(['adhoc', 'interval', 'textbox', 'system'])('should throw for unsupported (yet) variables', (type) => {
      const variable = {
        name: 'query0',
        type: type as VariableType,
      };

      expect(() => createVariableFromLegacyModel(variable)).toThrow();
    });
  });
});
