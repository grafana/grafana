import { type DataSourceInstanceListItem, type DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceInstanceList, getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { type Input } from 'app/features/dashboard/components/DashExportModal/DashboardExporter';
import { type DashboardInput, type DataSourceInput, InputType } from 'app/features/manage-dashboards/types';

import {
  isDataSourceInput,
  tryAutoMapDatasources,
  parseConstantInputs,
  mapConstantInputs,
  mapUserSelectedDatasources,
} from './autoMapDatasources';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceList: jest.fn(),
  getDataSourceInstanceSettings: jest.fn(),
}));

const mockGetDataSourceInstanceList = getDataSourceInstanceList as jest.MockedFunction<
  typeof getDataSourceInstanceList
>;
const mockGetDataSourceInstanceSettings = getDataSourceInstanceSettings as jest.MockedFunction<
  typeof getDataSourceInstanceSettings
>;

// Helpers — the new list API returns slim DataSourceInstanceListItem; the settings API
// returns full DataSourceInstanceSettings. We only assert against fields we actually read.
const listItem = (overrides: Partial<DataSourceInstanceListItem>): DataSourceInstanceListItem =>
  ({
    uid: 'uid',
    name: 'Name',
    type: 'type',
    ...overrides,
  }) as DataSourceInstanceListItem;
const settings = (overrides: Partial<DataSourceInstanceSettings>): DataSourceInstanceSettings =>
  ({
    uid: 'uid',
    name: 'Name',
    type: 'type',
    ...overrides,
  }) as DataSourceInstanceSettings;

// Helper functions for creating mock objects
const createMockDataSourceInput = (overrides: Partial<DataSourceInput> = {}): DataSourceInput =>
  ({
    name: 'DS_PROMETHEUS',
    pluginId: 'prometheus',
    type: InputType.DataSource,
    label: 'Prometheus',
    value: '',
    info: 'Prometheus datasource',
    ...overrides,
  }) as DataSourceInput;

const createMockConstantInput = (overrides: Partial<DashboardInput> = {}): DashboardInput =>
  ({
    name: 'var_instance',
    type: InputType.Constant,
    label: 'Instance',
    value: 'default',
    description: 'Instance name',
    info: 'Instance name',
    pluginId: undefined,
    ...overrides,
  }) as DashboardInput;

const createMockInput = (overrides: Partial<Input> = {}): Input =>
  ({
    name: 'test_input',
    type: 'constant',
    label: 'Test',
    value: 'default',
    description: 'Test input',
    ...overrides,
  }) as Input;

describe('autoMapDatasources', () => {
  describe('isDataSourceInput', () => {
    it('should return true for datasource input with pluginId', () => {
      const input = { ...createMockInput({ type: 'datasource' }), pluginId: 'prometheus' };

      expect(isDataSourceInput(input)).toBe(true);
    });

    it('should return false for constant input', () => {
      const input = createMockInput({ type: 'constant' });

      expect(isDataSourceInput(input)).toBe(false);
    });

    it('should return false for datasource input missing pluginId', () => {
      const input = createMockInput({ type: 'datasource' });

      expect(isDataSourceInput(input)).toBe(false);
    });
  });

  describe('tryAutoMapDatasources', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should auto-map when current datasource matches required type', async () => {
      const input = createMockDataSourceInput({ pluginId: 'prometheus' });
      const currentDatasourceUid = 'prom-uid';

      mockGetDataSourceInstanceList.mockResolvedValue([
        listItem({ uid: 'prom-uid', type: 'prometheus' }),
        listItem({ uid: 'prom-uid-2', type: 'prometheus' }),
      ]);

      const result = await tryAutoMapDatasources([input], currentDatasourceUid);

      expect(result.allMapped).toBe(true);
      expect(result.mappings).toHaveLength(1);
      expect(result.mappings[0]).toEqual({
        name: 'DS_PROMETHEUS',
        type: 'datasource',
        pluginId: 'prometheus',
        value: 'prom-uid',
      });
      expect(result.unmappedDsInputs).toHaveLength(0);
    });

    it('should auto-map single compatible datasource when current datasource is same type', async () => {
      const input = createMockDataSourceInput({ pluginId: 'prometheus' });
      const currentDatasourceUid = 'other-uid';

      mockGetDataSourceInstanceList.mockResolvedValue([listItem({ uid: 'prom-uid', type: 'prometheus' })]);
      mockGetDataSourceInstanceSettings.mockResolvedValue(settings({ uid: 'other-uid', type: 'prometheus' }));

      const result = await tryAutoMapDatasources([input], currentDatasourceUid);

      expect(result.allMapped).toBe(true);
      expect(result.mappings).toHaveLength(1);
      expect(result.mappings[0].value).toBe('prom-uid');
    });

    it('should not auto-map single compatible datasource when current datasource is different type', async () => {
      const input = createMockDataSourceInput({ pluginId: 'prometheus' });
      const currentDatasourceUid = 'loki-uid';

      mockGetDataSourceInstanceList.mockResolvedValue([listItem({ uid: 'prom-uid', type: 'prometheus' })]);
      mockGetDataSourceInstanceSettings.mockResolvedValue(settings({ uid: 'loki-uid', type: 'loki' }));

      const result = await tryAutoMapDatasources([input], currentDatasourceUid);

      expect(result.allMapped).toBe(false);
      expect(result.mappings).toHaveLength(0);
      expect(result.unmappedDsInputs).toHaveLength(1);
    });

    it('should not auto-map when multiple compatible datasources exist', async () => {
      const input = createMockDataSourceInput({ pluginId: 'prometheus' });
      const currentDatasourceUid = 'loki-uid';

      mockGetDataSourceInstanceList.mockResolvedValue([
        listItem({ uid: 'prom-uid-1', type: 'prometheus' }),
        listItem({ uid: 'prom-uid-2', type: 'prometheus' }),
      ]);

      const result = await tryAutoMapDatasources([input], currentDatasourceUid);

      expect(result.allMapped).toBe(false);
      expect(result.mappings).toHaveLength(0);
      expect(result.unmappedDsInputs).toHaveLength(1);
    });

    it('should return unmapped when no compatible datasources exist', async () => {
      const input = createMockDataSourceInput({ pluginId: 'prometheus' });
      const currentDatasourceUid = 'loki-uid';

      mockGetDataSourceInstanceList.mockResolvedValue([]);

      const result = await tryAutoMapDatasources([input], currentDatasourceUid);

      expect(result.allMapped).toBe(false);
      expect(result.mappings).toHaveLength(0);
      expect(result.unmappedDsInputs).toHaveLength(1);
    });

    it('should handle empty inputs array', async () => {
      const result = await tryAutoMapDatasources([], 'any-uid');

      expect(result.allMapped).toBe(true);
      expect(result.mappings).toHaveLength(0);
      expect(result.unmappedDsInputs).toHaveLength(0);
    });

    it('should filter out datasources without UIDs', async () => {
      const input = createMockDataSourceInput({ pluginId: 'prometheus' });
      const currentDatasourceUid = 'prom-uid'; // Current datasource matches the required type

      mockGetDataSourceInstanceList.mockResolvedValue([
        listItem({ uid: 'prom-uid', type: 'prometheus' }),
        // Cast: the test exercises a defensive filter for items missing `uid` even though
        // the public `DataSourceInstanceListItem` type marks `uid` as required.
        { type: 'prometheus' } as DataSourceInstanceListItem,
        { uid: undefined, type: 'prometheus' } as unknown as DataSourceInstanceListItem,
      ]);

      const result = await tryAutoMapDatasources([input], currentDatasourceUid);

      // Should auto-map since current datasource matches and there's only one valid datasource with UID
      expect(result.allMapped).toBe(true);
      expect(result.mappings).toHaveLength(1);
      expect(result.mappings[0].value).toBe('prom-uid');
    });
  });

  describe('parseConstantInputs', () => {
    it('should parse constant inputs from __inputs array', () => {
      const allInputs: Input[] = [
        createMockInput({ name: 'var_instance', type: 'constant', label: 'Instance', description: 'Instance name' }),
        createMockInput({
          name: 'var_env',
          type: 'constant',
          label: 'Environment',
          value: 'prod',
          description: 'Environment',
        }),
      ];

      const result = parseConstantInputs(allInputs);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'var_instance',
        label: 'Instance',
        description: 'Instance name',
        info: 'Instance name',
        value: 'default',
        type: InputType.Constant,
        pluginId: undefined,
      });
    });

    it('should filter out datasource inputs', () => {
      const allInputs: Input[] = [
        createMockInput({ name: 'var_instance', type: 'constant', description: 'Instance name' }),
        createMockInput({ name: 'DS_PROM', type: 'datasource', description: 'Prometheus datasource' }),
      ];

      const result = parseConstantInputs(allInputs);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('var_instance');
    });

    it('should handle empty inputs array', () => {
      const result = parseConstantInputs([]);

      expect(result).toHaveLength(0);
    });

    it('should handle null inputs', () => {
      const result = parseConstantInputs(null!);

      expect(result).toHaveLength(0);
    });

    it('should handle undefined inputs', () => {
      const result = parseConstantInputs(undefined!);

      expect(result).toHaveLength(0);
    });

    it('should use label as fallback when label is missing', () => {
      const input = createMockInput({ name: 'var_instance', type: 'constant', label: '' });
      const result = parseConstantInputs([input]);

      expect(result[0].label).toBe('var_instance');
    });

    it('should use default info when description is missing', () => {
      const input = createMockInput({ name: 'var_instance', type: 'constant', description: '' });
      const result = parseConstantInputs([input]);

      expect(result[0].info).toBe('Specify a string constant');
    });
  });

  describe('mapConstantInputs', () => {
    it('should use user-provided values when available', () => {
      const constantInputs: DashboardInput[] = [createMockConstantInput()];
      const userValues = { var_instance: 'custom-value' };

      const result = mapConstantInputs(constantInputs, userValues);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'var_instance',
        type: 'constant',
        value: 'custom-value',
      });
    });

    it('should fall back to default values when user values not provided', () => {
      const constantInputs: DashboardInput[] = [createMockConstantInput()];
      const userValues = {};

      const result = mapConstantInputs(constantInputs, userValues);

      expect(result[0].value).toBe('default');
    });

    it('should handle empty constantInputs array', () => {
      const result = mapConstantInputs([], {});

      expect(result).toHaveLength(0);
    });
  });

  describe('mapUserSelectedDatasources', () => {
    it('should map user selections to InputMapping format', () => {
      const unmappedInputs: DataSourceInput[] = [createMockDataSourceInput()];
      const userSelectedDsMappings = {
        DS_PROMETHEUS: {
          name: 'DS_PROMETHEUS',
          pluginId: 'prometheus',
          datasource: { uid: 'selected-uid' },
        },
      };

      const result = mapUserSelectedDatasources(unmappedInputs, userSelectedDsMappings);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'DS_PROMETHEUS',
        type: 'datasource',
        pluginId: 'prometheus',
        value: 'selected-uid',
      });
    });

    it('should handle missing datasource selections', () => {
      const unmappedInputs: DataSourceInput[] = [createMockDataSourceInput()];
      const userSelectedDsMappings = {};

      const result = mapUserSelectedDatasources(unmappedInputs, userSelectedDsMappings);

      expect(result[0].value).toBe('');
    });

    it('should handle undefined datasource in selection', () => {
      const unmappedInputs: DataSourceInput[] = [createMockDataSourceInput()];
      const userSelectedDsMappings = {
        DS_PROMETHEUS: {
          name: 'DS_PROMETHEUS',
          pluginId: 'prometheus',
          datasource: undefined,
        },
      };

      const result = mapUserSelectedDatasources(unmappedInputs, userSelectedDsMappings);

      expect(result[0].value).toBe('');
    });
  });
});
