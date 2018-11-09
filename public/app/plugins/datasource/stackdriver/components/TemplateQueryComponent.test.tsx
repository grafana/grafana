import React from 'react';
import renderer from 'react-test-renderer';
import { StackdriverTemplateQueryComponent } from './TemplateQueryComponent';
import { TemplateQueryProps } from 'app/types/plugins';
import { MetricFindQueryTypes } from '../types';

jest.mock('../functions', () => ({
  getMetricTypes: () => ({ metricTypes: [], selectedMetricType: '' }),
}));

const props: TemplateQueryProps = {
  onChange: (query, definition) => {},
  query: {},
  datasource: {
    getMetricTypes: async p => [],
  },
};

describe('StackdriverTemplateQueryComponent', () => {
  it('renders correctly', () => {
    const tree = renderer.create(<StackdriverTemplateQueryComponent {...props} />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  describe('and a new variable is created', () => {
    it('should trigger a query using the first query type in the array', done => {
      props.onChange = (query, definition) => {
        expect(definition).toBe('Stackdriver - Metric Types');
        done();
      };
      renderer.create(<StackdriverTemplateQueryComponent {...props} />).toJSON();
    });
  });

  describe('and an existing variable is edited', () => {
    it('should trigger new query using the saved query type', done => {
      props.query = { selectedQueryType: MetricFindQueryTypes.MetricLabels };
      props.onChange = (query, definition) => {
        expect(definition).toBe('Stackdriver - Metric Labels');
        done();
      };
      renderer.create(<StackdriverTemplateQueryComponent {...props} />).toJSON();
    });
  });
});
