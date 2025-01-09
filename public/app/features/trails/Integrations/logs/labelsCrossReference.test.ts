const queryRunnerMock = jest.fn(); // this must be defined before imports so we can dynamically mock the implementation of `SceneQueryRunner`
import { of } from 'rxjs';

import { LoadingState } from '@grafana/data';
import { AdHocFiltersVariable, sceneGraph } from '@grafana/scenes';

import { DataTrail } from '../../DataTrail';
import { RelatedLogsScene } from '../../RelatedLogs/RelatedLogsScene';
import { VAR_FILTERS } from '../../shared';
import * as utils from '../../utils';

import { createLabelsCrossReferenceConnector } from './labelsCrossReference';

type Label = { key: string; operator: string; value: string };

function setVariables(variables: Label[] | null) {
  sceneGraphSpy.mockReturnValue(variables ? createAdHocVariableStub(variables) : null);
}

function setVariablesAndQueryResponse({
  variables,
  labelsInResponse,
}: {
  variables: Label[] | null;
  labelsInResponse: boolean;
}) {
  setVariables(variables);
  setQueryRunnerMockResults(labelsInResponse);
}

function setQueryRunnerMockResults(hasLogs: boolean) {
  const label = { arbitrary: 'labelValue' };
  queryRunnerMock.mockImplementation(() => ({
    activate: jest.fn(),
    getResultsStream: () =>
      of({
        data: {
          state: LoadingState.Done,
          series: [
            {
              fields: [
                {
                  name: 'labels',
                  values: hasLogs ? [label] : [],
                },
              ],
            },
          ],
        },
      }),
    subscribeToState: jest.fn((callback) => {
      callback({
        data: {
          state: LoadingState.Done,
          series: [
            {
              fields: [
                {
                  name: 'labels',
                  values: hasLogs ? [label] : [],
                },
              ],
            },
          ],
        },
      });
      return { unsubscribe: jest.fn() };
    }),
  }));
}

const lokiDataSourcesStub = [
  {
    id: 1,
    uid: 'loki1',
    name: 'Loki Prod',
    type: 'loki',
  },
  {
    id: 2,
    uid: 'loki2',
    name: 'Loki Staging',
    type: 'loki',
  },
  {
    id: 3,
    uid: 'loki3',
    name: 'Loki Dev',
    type: 'loki',
  },
];
const getListSpy = jest.fn().mockReturnValue(lokiDataSourcesStub);

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getList: getListSpy,
    get: jest.fn().mockResolvedValue({ uid: 'loki1' }),
  }),
  getTemplateSrv: () => ({
    getAdhocFilters: jest.fn(),
  }),
}));

jest.mock('@grafana/scenes', () => {
  const originalModule = jest.requireActual('@grafana/scenes');
  return {
    ...originalModule,
    SceneQueryRunner: queryRunnerMock,
  };
});

const getTrailForSpy = jest.spyOn(utils, 'getTrailFor');
const sceneGraphSpy = jest.spyOn(sceneGraph, 'lookupVariable');

const mockScene = {
  state: {},
  useState: jest.fn(),
} as unknown as RelatedLogsScene;

const createAdHocVariableStub = (filters: Label[]) => {
  return {
    __typename: 'AdHocFiltersVariable',
    state: {
      name: VAR_FILTERS,
      type: 'adhoc',
      filters,
    },
  } as unknown as AdHocFiltersVariable;
};

const filtersStub = [
  { key: 'environment', operator: '=', value: 'production' },
  { key: 'app', operator: '=', value: 'frontend' },
];

describe('LabelsCrossReferenceConnector', () => {
  beforeEach(() => {
    getListSpy.mockClear();
    queryRunnerMock.mockClear();
    sceneGraphSpy.mockClear();
    getTrailForSpy.mockReturnValue(new DataTrail({}));
  });

  describe('getDataSources', () => {
    it('should find Loki data sources with matching labels', async () => {
      const connector = createLabelsCrossReferenceConnector(mockScene);
      setVariablesAndQueryResponse({
        variables: filtersStub,
        labelsInResponse: true,
      });
      const result = await connector.getDataSources();

      expect(result).toHaveLength(lokiDataSourcesStub.length);
      expect(result).toEqual(expect.arrayContaining(lokiDataSourcesStub));
      expect(getListSpy).toHaveBeenCalledWith({ logs: true, type: 'loki' });
    });

    it('should handle no filters case', async () => {
      sceneGraphSpy.mockReturnValue(createAdHocVariableStub([]));
      setVariablesAndQueryResponse({
        variables: [],
        labelsInResponse: false,
      });

      const connector = createLabelsCrossReferenceConnector(mockScene);
      const result = await connector.getDataSources();

      expect(result).toHaveLength(0);
    });

    it('should handle missing filters variable', async () => {
      setVariablesAndQueryResponse({
        variables: null,
        labelsInResponse: false,
      });

      const connector = createLabelsCrossReferenceConnector(mockScene);
      const result = await connector.getDataSources();

      expect(result).toHaveLength(0);
    });
  });

  describe('getLokiQueryExpr', () => {
    it('should generate correct Loki query expression from filters', () => {
      const connector = createLabelsCrossReferenceConnector(mockScene);
      setVariables(filtersStub);
      const result = connector.getLokiQueryExpr();

      expect(result).toBe('{environment="production",app="frontend"}');
    });

    it('should return empty string when no filters are present', () => {
      setVariables([]);
      sceneGraphSpy.mockReturnValue(createAdHocVariableStub([]));

      const connector = createLabelsCrossReferenceConnector(mockScene);
      const result = connector.getLokiQueryExpr();

      expect(result).toBe('');
    });

    it('should handle different filter operators', () => {
      setVariables([
        { key: 'environment', operator: '!=', value: 'dev' },
        { key: 'level', operator: '=~', value: 'error|warn' },
      ]);

      const connector = createLabelsCrossReferenceConnector(mockScene);
      const result = connector.getLokiQueryExpr();

      expect(result).toBe('{environment!="dev",level=~"error|warn"}');
    });

    it('should handle missing filters variable', () => {
      setVariables(null);

      const connector = createLabelsCrossReferenceConnector(mockScene);
      const result = connector.getLokiQueryExpr();

      expect(result).toBe('');
    });
  });
});
