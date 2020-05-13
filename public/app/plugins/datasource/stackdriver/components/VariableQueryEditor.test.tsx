import React from 'react';
// @ts-ignore
import renderer from 'react-test-renderer';
import { StackdriverVariableQueryEditor } from './VariableQueryEditor';
import { VariableQueryProps } from 'app/types/plugins';
import { MetricFindQueryTypes } from '../types';
import { VariableModel } from 'app/features/templating/types';

jest.mock('../functions', () => ({
  getMetricTypes: (): any => ({ metricTypes: [], selectedMetricType: '' }),
  extractServicesFromMetricDescriptors: (): any[] => [],
}));

jest.mock('../../../../core/config', () => {
  console.warn('[This test uses old variable system, needs a rewrite]');
  const original = jest.requireActual('../../../../core/config');
  const config = original.getConfig();
  return {
    getConfig: () => ({
      ...config,
      featureToggles: {
        ...config.featureToggles,
        newVariables: false,
      },
    }),
  };
});

const props: VariableQueryProps = {
  onChange: (query, definition) => {},
  query: {},
  datasource: {
    getDefaultProject: () => '',
    getProjects: async () => Promise.resolve([]),
    getMetricTypes: async (projectName: string) => Promise.resolve([]),
    getSLOServices: async (projectName: string, serviceId: string) => Promise.resolve([]),
    getServiceLevelObjectives: (projectName: string, serviceId: string) => Promise.resolve([]),
  },
  templateSrv: { replace: (s: string) => s, getVariables: () => ([] as unknown) as VariableModel[] },
};

describe('VariableQueryEditor', () => {
  it('renders correctly', () => {
    const tree = renderer.create(<StackdriverVariableQueryEditor {...props} />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  describe('and a new variable is created', () => {
    it('should trigger a query using the first query type in the array', done => {
      props.onChange = (query, definition) => {
        expect(definition).toBe('Stackdriver - Projects');
        done();
      };
      renderer.create(<StackdriverVariableQueryEditor {...props} />).toJSON();
    });
  });

  describe('and an existing variable is edited', () => {
    it('should trigger new query using the saved query type', done => {
      props.query = { selectedQueryType: MetricFindQueryTypes.LabelKeys };
      props.onChange = (query, definition) => {
        expect(definition).toBe('Stackdriver - Label Keys');
        done();
      };
      renderer.create(<StackdriverVariableQueryEditor {...props} />).toJSON();
    });
  });
});
