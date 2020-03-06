import React from 'react';
// @ts-ignore
import renderer from 'react-test-renderer';
import { StackdriverVariableQueryEditor } from './VariableQueryEditor';
import { VariableQueryProps } from 'app/types/plugins';
import { MetricFindQueryTypes } from '../types';

jest.mock('../functions', () => ({
  getMetricTypes: (): any => ({ metricTypes: [], selectedMetricType: '' }),
  extractServicesFromMetricDescriptors: (): any[] => [],
}));

const props: VariableQueryProps = {
  onChange: (query, definition) => {},
  query: {},
  datasource: {
    getDefaultProject: () => '',
    getProjects: async (): Promise<any[]> => [],
    getMetricTypes: async (p: any): Promise<any[]> => [],
  },
  templateSrv: { replace: (s: string) => s, variables: [] },
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
