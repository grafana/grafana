import React from 'react';
import Enzyme, { shallow } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

Enzyme.configure({ adapter: new Adapter() });

import PromQueryField from './PromQueryField';

describe('PromQueryField typeahead handling', () => {
  const defaultProps = {
    request: () => ({ data: { data: [] } }),
  };

  it('returns no suggestions on emtpty context', () => {
    const instance = shallow(<PromQueryField {...defaultProps} />).instance() as PromQueryField;
    const result = instance.getTypeahead('', 0, []);
    expect(result.context).toBe(null);
    expect(result.prefix).toBe('');
    expect(result.refresher).toBe(null);
    expect(result.suggestions).toEqual([]);
  });

  describe('range suggestions', () => {
    it('returns range suggestions in range context', () => {
      const instance = shallow(<PromQueryField {...defaultProps} />).instance() as PromQueryField;
      const result = instance.getTypeahead('1', 1, ['context-range']);
      expect(result.context).toBe('context-range');
      expect(result.prefix).toBe('1');
      expect(result.refresher).toBe(null);
      expect(result.suggestions).toEqual([
        {
          items: [{ text: '1m' }, { text: '5m' }, { text: '10m' }, { text: '30m' }, { text: '1h' }],
          label: 'Range vector',
        },
      ]);
    });
  });

  describe('metric suggestions', () => {
    it('returns metrics suggestions by default', () => {
      const instance = shallow(
        <PromQueryField {...defaultProps} metrics={['foo', 'bar']} />
      ).instance() as PromQueryField;
      const result = instance.getTypeahead('a', 1, []);
      expect(result.context).toBe('context-metrics');
      expect(result.prefix).toBe('a');
      expect(result.refresher).toBe(null);
      expect(result.suggestions).toEqual([{ items: [{ text: 'foo' }, { text: 'bar' }], label: 'Metrics' }]);
    });

    it('returns metrics suggestions after a binary operator', () => {
      const instance = shallow(
        <PromQueryField {...defaultProps} metrics={['foo', 'bar']} />
      ).instance() as PromQueryField;
      const result = instance.getTypeahead('*', 1, []);
      expect(result.context).toBe('context-metrics');
      expect(result.prefix).toBe('');
      expect(result.refresher).toBe(null);
      expect(result.suggestions).toEqual([{ items: [{ text: 'foo' }, { text: 'bar' }], label: 'Metrics' }]);
    });
  });

  describe('label suggestions', () => {
    it('returns default label suggestions on label context and no metric', () => {
      const instance = shallow(<PromQueryField {...defaultProps} />).instance() as PromQueryField;
      const result = instance.getTypeahead('j', 1, ['context-labels']);
      expect(result.context).toBe('context-labels');
      expect(result.suggestions).toEqual([{ items: [{ text: 'job' }, { text: 'instance' }], label: 'Labels' }]);
    });

    it('returns label suggestions on label context and metric', () => {
      const instance = shallow(
        <PromQueryField {...defaultProps} labelKeys={{ foo: ['bar'] }} />
      ).instance() as PromQueryField;
      const result = instance.getTypeahead('job', 3, ['context-labels'], 'foo');
      expect(result.context).toBe('context-labels');
      expect(result.suggestions).toEqual([{ items: [{ text: 'bar' }], label: 'Labels' }]);
    });

    it('returns a refresher on label context and unavailable metric', () => {
      const instance = shallow(
        <PromQueryField {...defaultProps} labelKeys={{ foo: ['bar'] }} />
      ).instance() as PromQueryField;
      const result = instance.getTypeahead('job', 3, ['context-labels'], 'xxx');
      expect(result.context).toBe(null);
      expect(result.refresher).toBeInstanceOf(Promise);
      expect(result.suggestions).toEqual([]);
    });

    it('returns label values on label context when given a metric and a label key', () => {
      const instance = shallow(
        <PromQueryField {...defaultProps} labelKeys={{ foo: ['bar'] }} labelValues={{ foo: { bar: ['baz'] } }} />
      ).instance() as PromQueryField;
      const result = instance.getTypeahead('=ba', 3, ['context-labels'], 'foo', 'bar');
      expect(result.context).toBe('context-label-values');
      expect(result.suggestions).toEqual([{ items: [{ text: 'baz' }], label: 'Label values' }]);
    });

    it('returns label suggestions on aggregation context and metric', () => {
      const instance = shallow(
        <PromQueryField {...defaultProps} labelKeys={{ foo: ['bar'] }} />
      ).instance() as PromQueryField;
      const result = instance.getTypeahead('job', 3, ['context-aggregation'], 'foo');
      expect(result.context).toBe('context-aggregation');
      expect(result.suggestions).toEqual([{ items: [{ text: 'bar' }], label: 'Labels' }]);
    });
  });
});
