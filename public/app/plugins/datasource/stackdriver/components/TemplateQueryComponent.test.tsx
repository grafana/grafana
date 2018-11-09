import React from 'react';
import renderer from 'react-test-renderer';
import { StackdriverTemplateQueryComponent } from './TemplateQueryComponent';
import { TemplateQueryProps } from 'app/types/plugins';

jest.mock('../functions', () => ({
  getMetricTypes: () => Promise.resolve({ metricTypes: [], selectedMetricType: '' }),
  extractServicesFromMetricDescriptors: m => m,
}));

const props: TemplateQueryProps = {
  onChange: (query, definition) => {},
  query: '',
  datasource: {
    getMetricTypes: async p => [],
  },
};

describe('StackdriverTemplateQueryComponent', () => {
  it('renders correctly', () => {
    const tree = renderer.create(<StackdriverTemplateQueryComponent {...props} />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('should use the first query type in the array if no query type was saved before', done => {
    props.onChange = (query, definition) => {
      expect(definition).toBe('Stackdriver - Services');
      done();
    };
    renderer.create(<StackdriverTemplateQueryComponent {...props} />).toJSON();
  });
});
