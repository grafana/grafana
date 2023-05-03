import React from 'react';
// @ts-ignore
import renderer from 'react-test-renderer';

import { VariableModel } from '@grafana/data';

import CloudMonitoringDatasource from '../datasource';
import { MetricFindQueryTypes } from '../types/query';
import { CloudMonitoringVariableQuery } from '../types/types';

import { CloudMonitoringVariableQueryEditor, Props } from './VariableQueryEditor';

jest.mock('../functions', () => ({
  getMetricTypes: () => ({ metricTypes: [], selectedMetricType: '' }),
  extractServicesFromMetricDescriptors: () => [],
}));

jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');
  return {
    ...original,
    getTemplateSrv: () => ({
      replace: (s: string) => s,
      getVariables: () => [] as unknown as VariableModel[],
    }),
  };
});

const props: Props = {
  onChange: (query) => {},
  query: {} as unknown as CloudMonitoringVariableQuery,
  datasource: {
    getDefaultProject: () => '',
    getProjects: async () => Promise.resolve([]),
    getMetricTypes: async (projectName: string) => Promise.resolve([]),
    getSLOServices: async (projectName: string) => Promise.resolve([]),
    getServiceLevelObjectives: (projectName: string, serviceId: string) => Promise.resolve([]),
    ensureGCEDefaultProject: async () => Promise.resolve(''),
  } as unknown as CloudMonitoringDatasource,
  onRunQuery: () => {},
};

describe('VariableQueryEditor', () => {
  it('renders correctly', () => {
    const tree = renderer.create(<CloudMonitoringVariableQueryEditor {...props} />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  describe('and a new variable is created', () => {
    it('should trigger a query using the first query type in the array', (done) => {
      props.onChange = (query) => {
        expect(query.selectedQueryType).toBe('projects');
        done();
      };
      renderer.create(<CloudMonitoringVariableQueryEditor {...props} />).toJSON();
    });
  });

  describe('and an existing variable is edited', () => {
    it('should trigger new query using the saved query type', (done) => {
      props.query = { selectedQueryType: MetricFindQueryTypes.LabelKeys } as unknown as CloudMonitoringVariableQuery;
      props.onChange = (query) => {
        expect(query.selectedQueryType).toBe('labelKeys');
        done();
      };
      renderer.create(<CloudMonitoringVariableQueryEditor {...props} />).toJSON();
    });
  });
});
