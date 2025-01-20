import { type AdHocVariableFilter } from '@grafana/data';
import { AdHocFiltersVariable, sceneGraph } from '@grafana/scenes';

import { DataTrail } from '../../DataTrail';
import { RelatedLogsScene } from '../../RelatedLogs/RelatedLogsScene';
import { VAR_FILTERS } from '../../shared';
import * as utils from '../../utils';

import { createLabelsCrossReferenceConnector } from './labelsCrossReference';

// Create multiple mock Loki datasources with different behaviors
const mockLokiDS1 = {
  uid: 'loki1',
  name: 'Loki Production',
  getTagKeys: jest.fn(),
  getTagValues: jest.fn(),
};

const mockLokiDS2 = {
  uid: 'loki2',
  name: 'Loki Staging',
  getTagKeys: jest.fn(),
  getTagValues: jest.fn(),
};

const mockLokiDS3 = {
  uid: 'loki3',
  name: 'Loki Development',
  getTagKeys: jest.fn(),
  getTagValues: jest.fn(),
};

function setVariables(variables: AdHocVariableFilter[] | null) {
  sceneGraphSpy.mockReturnValue(variables ? createAdHocVariableStub(variables) : null);
}

const createAdHocVariableStub = (filters: AdHocVariableFilter[]) => {
  return {
    __typename: 'AdHocFiltersVariable',
    state: {
      name: VAR_FILTERS,
      type: 'adhoc',
      filters,
    },
  } as unknown as AdHocFiltersVariable;
};

const filtersStub: AdHocVariableFilter[] = [
  { key: 'environment', operator: '=', value: 'production' },
  { key: 'app', operator: '=', value: 'frontend' },
];

const mockDatasources = [mockLokiDS1, mockLokiDS2, mockLokiDS3];
const getListSpy = jest.fn().mockReturnValue(mockDatasources);
const getSpy = jest.fn().mockImplementation(async (uid: string) => {
  const ds = mockDatasources.find((ds) => ds.uid === uid);
  if (!ds) {
    throw new Error(`Datasource with uid ${uid} not found`);
  }
  return ds;
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getList: getListSpy,
    get: getSpy,
  }),
  getTemplateSrv: () => ({
    getAdhocFilters: jest.fn(),
  }),
  getBackendSrv: () => ({
    get: jest.fn().mockResolvedValue({ status: 'OK' }), // Mock successful health checks
  }),
}));

const getTrailForSpy = jest.spyOn(utils, 'getTrailFor');
const sceneGraphSpy = jest.spyOn(sceneGraph, 'lookupVariable');

const mockScene = {
  state: {},
  useState: jest.fn(),
} as unknown as RelatedLogsScene;

describe('LabelsCrossReferenceConnector', () => {
  beforeEach(() => {
    getListSpy.mockClear();
    sceneGraphSpy.mockClear();
    getTrailForSpy.mockReturnValue(new DataTrail({}));
    [mockLokiDS1, mockLokiDS2, mockLokiDS3].forEach((mockLokiDs) => {
      mockLokiDs.getTagKeys.mockClear();
      mockLokiDs.getTagValues.mockClear();
    });
  });

  describe('getDataSources', () => {
    it('should find multiple Loki data sources with matching labels', async () => {
      // DS1: Has all required labels and values
      mockLokiDS1.getTagKeys.mockResolvedValue([{ text: 'environment' }, { text: 'app' }]);
      mockLokiDS1.getTagValues.mockResolvedValue([{ text: 'production' }, { text: 'frontend' }]);

      // DS2: Has labels but missing values
      mockLokiDS2.getTagKeys.mockResolvedValue([{ text: 'environment' }, { text: 'app' }]);
      mockLokiDS2.getTagValues.mockResolvedValue([
        { text: 'staging' }, // Different value
        { text: 'frontend' },
      ]);

      // DS3: Has all required labels and values
      mockLokiDS3.getTagKeys.mockResolvedValue([{ text: 'environment' }, { text: 'app' }]);
      mockLokiDS3.getTagValues.mockResolvedValue([{ text: 'production' }, { text: 'frontend' }]);

      setVariables(filtersStub);

      const connector = createLabelsCrossReferenceConnector(mockScene);
      const result = await connector.getDataSources();

      expect(result).toHaveLength(2);
      expect(result).toEqual([
        { uid: 'loki1', name: 'Loki Production' },
        { uid: 'loki3', name: 'Loki Development' },
      ]);

      // Verify that getTagKeys was called for all datasources
      expect(mockLokiDS1.getTagKeys).toHaveBeenCalled();
      expect(mockLokiDS2.getTagKeys).toHaveBeenCalled();
      expect(mockLokiDS3.getTagKeys).toHaveBeenCalled();

      // Verify filters were passed correctly
      const expectedFilters = [
        { key: 'environment', operator: '=', value: 'production' },
        { key: 'app', operator: '=', value: 'frontend' },
      ];

      expect(mockLokiDS1.getTagKeys).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.arrayContaining(expectedFilters),
        })
      );
    });

    it('should handle mixed availability of label keys across datasources', async () => {
      // DS1: Has all required labels
      mockLokiDS1.getTagKeys.mockResolvedValue([{ text: 'environment' }, { text: 'app' }]);
      mockLokiDS1.getTagValues.mockResolvedValue([{ text: 'production' }, { text: 'frontend' }]);

      // DS2: Missing some required labels
      mockLokiDS2.getTagKeys.mockResolvedValue([
        { text: 'environment' }, // missing 'app'
      ]);

      // DS3: Has different set of labels
      mockLokiDS3.getTagKeys.mockResolvedValue([{ text: 'region' }, { text: 'cluster' }]);

      setVariables(filtersStub);

      const connector = createLabelsCrossReferenceConnector(mockScene);
      const result = await connector.getDataSources();

      expect(result).toHaveLength(1);
      expect(result).toEqual([{ uid: 'loki1', name: 'Loki Production' }]);

      // DS2 and DS3 should not have getTagValues called since they don't have all required labels
      expect(mockLokiDS1.getTagValues).toHaveBeenCalled();
      expect(mockLokiDS2.getTagValues).not.toHaveBeenCalled();
      expect(mockLokiDS3.getTagValues).not.toHaveBeenCalled();
    });

    it('should handle known label name discrepancies across multiple datasources', async () => {
      const filtersWithKnownLabels: AdHocVariableFilter[] = [
        { key: 'job', operator: '=', value: 'grafana' },
        { key: 'instance', operator: '=', value: 'instance1' },
      ];

      // DS1: Has matching labels with known discrepancies
      mockLokiDS1.getTagKeys.mockResolvedValue([{ text: 'service_name' }, { text: 'service_instance_id' }]);
      mockLokiDS1.getTagValues.mockResolvedValue([{ text: 'grafana' }, { text: 'instance1' }]);

      // DS2: Also has transformed label names
      mockLokiDS2.getTagKeys.mockResolvedValue([{ text: 'service_name' }, { text: 'service_instance_id' }]);
      mockLokiDS2.getTagValues.mockResolvedValue([{ text: 'grafana' }, { text: 'instance1' }]);

      // DS3: Missing required labels
      mockLokiDS3.getTagKeys.mockResolvedValue([
        { text: 'service_name' }, // missing service_instance_id
      ]);

      setVariables(filtersWithKnownLabels);

      const connector = createLabelsCrossReferenceConnector(mockScene);
      const result = await connector.getDataSources();

      expect(result).toHaveLength(2);
      expect(result).toEqual([
        { uid: 'loki1', name: 'Loki Production' },
        { uid: 'loki2', name: 'Loki Staging' },
      ]);

      // Verify that label name mapping was applied correctly
      expect(mockLokiDS1.getTagKeys).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.arrayContaining([
            expect.objectContaining({ key: 'service_name' }),
            expect.objectContaining({ key: 'service_instance_id' }),
          ]),
        })
      );
    });
  });

  // Rest of the tests remain the same...
  describe('getLokiQueryExpr', () => {
    it('should generate correct Loki query expression from filters', () => {
      setVariables(filtersStub);
      const connector = createLabelsCrossReferenceConnector(mockScene);
      const result = connector.getLokiQueryExpr();

      expect(result).toBe('{environment="production",app="frontend"}');
    });

    it('should handle conversion of known label names', () => {
      const filtersWithKnownLabels: AdHocVariableFilter[] = [
        { key: 'job', operator: '=', value: 'grafana' },
        { key: 'instance', operator: '=', value: 'instance1' },
      ];
      setVariables(filtersWithKnownLabels);

      const connector = createLabelsCrossReferenceConnector(mockScene);
      const result = connector.getLokiQueryExpr();

      expect(result).toBe('{service_name="grafana",service_instance_id="instance1"}');
    });

    it('should return empty string when no filters are present', () => {
      setVariables([]);
      const connector = createLabelsCrossReferenceConnector(mockScene);
      const result = connector.getLokiQueryExpr();

      expect(result).toBe('');
    });

    it('should handle missing filters variable', () => {
      setVariables(null);
      const connector = createLabelsCrossReferenceConnector(mockScene);
      const result = connector.getLokiQueryExpr();

      expect(result).toBe('');
    });

    it('should handle different filter operators', () => {
      const filtersWithOperators: AdHocVariableFilter[] = [
        { key: 'environment', operator: '!=', value: 'dev' },
        { key: 'level', operator: '=~', value: 'error|warn' },
      ];
      setVariables(filtersWithOperators);

      const connector = createLabelsCrossReferenceConnector(mockScene);
      const result = connector.getLokiQueryExpr();

      expect(result).toBe('{environment!="dev",level=~"error|warn"}');
    });
  });
});
