import React from 'react';
import Enzyme, { shallow } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

Enzyme.configure({ adapter: new Adapter() });

import PromQueryField from './PromQueryField';

describe('PromQueryField typeahead handling', () => {
  const defaultProps = {
    request: () => ({ data: { data: [] } }),
  };

  it('returns default suggestions on emtpty context', () => {
    const instance = shallow(<PromQueryField {...defaultProps} />).instance() as PromQueryField;
    const result = instance.getTypeahead({ text: '', prefix: '', wrapperClasses: [] });
    expect(result.context).toBeUndefined();
    expect(result.refresher).toBeUndefined();
    expect(result.suggestions.length).toEqual(2);
  });

  describe('range suggestions', () => {
    it('returns range suggestions in range context', () => {
      const instance = shallow(<PromQueryField {...defaultProps} />).instance() as PromQueryField;
      const result = instance.getTypeahead({ text: '1', prefix: '1', wrapperClasses: ['context-range'] });
      expect(result.context).toBe('context-range');
      expect(result.refresher).toBeUndefined();
      expect(result.suggestions).toEqual([
        {
          items: [{ label: '1m' }, { label: '5m' }, { label: '10m' }, { label: '30m' }, { label: '1h' }],
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
      const result = instance.getTypeahead({ text: 'a', prefix: 'a', wrapperClasses: [] });
      expect(result.context).toBeUndefined();
      expect(result.refresher).toBeUndefined();
      expect(result.suggestions.length).toEqual(2);
    });

    it('returns default suggestions after a binary operator', () => {
      const instance = shallow(
        <PromQueryField {...defaultProps} metrics={['foo', 'bar']} />
      ).instance() as PromQueryField;
      const result = instance.getTypeahead({ text: '*', prefix: '', wrapperClasses: [] });
      expect(result.context).toBeUndefined();
      expect(result.refresher).toBeUndefined();
      expect(result.suggestions.length).toEqual(2);
    });
  });

  describe('label suggestions', () => {
    it('returns default label suggestions on label context and no metric', () => {
      const instance = shallow(<PromQueryField {...defaultProps} />).instance() as PromQueryField;
      const result = instance.getTypeahead({ text: 'j', prefix: 'j', wrapperClasses: ['context-labels'] });
      expect(result.context).toBe('context-labels');
      expect(result.suggestions).toEqual([{ items: [{ label: 'job' }, { label: 'instance' }], label: 'Labels' }]);
    });

    it('returns label suggestions on label context and metric', () => {
      const instance = shallow(
        <PromQueryField {...defaultProps} labelKeys={{ foo: ['bar'] }} />
      ).instance() as PromQueryField;
      const result = instance.getTypeahead({
        text: 'job',
        prefix: 'job',
        wrapperClasses: ['context-labels'],
        metric: 'foo',
      });
      expect(result.context).toBe('context-labels');
      expect(result.suggestions).toEqual([{ items: [{ label: 'bar' }], label: 'Labels' }]);
    });

    it('returns a refresher on label context and unavailable metric', () => {
      const instance = shallow(
        <PromQueryField {...defaultProps} labelKeys={{ foo: ['bar'] }} />
      ).instance() as PromQueryField;
      const result = instance.getTypeahead({
        text: 'job',
        prefix: 'job',
        wrapperClasses: ['context-labels'],
        metric: 'xxx',
      });
      expect(result.context).toBeUndefined();
      expect(result.refresher).toBeInstanceOf(Promise);
      expect(result.suggestions).toEqual([]);
    });

    it('returns label values on label context when given a metric and a label key', () => {
      const instance = shallow(
        <PromQueryField {...defaultProps} labelKeys={{ foo: ['bar'] }} labelValues={{ foo: { bar: ['baz'] } }} />
      ).instance() as PromQueryField;
      const result = instance.getTypeahead({
        text: '=ba',
        prefix: 'ba',
        wrapperClasses: ['context-labels'],
        metric: 'foo',
        labelKey: 'bar',
      });
      expect(result.context).toBe('context-label-values');
      expect(result.suggestions).toEqual([{ items: [{ label: 'baz' }], label: 'Label values' }]);
    });

    it('returns label suggestions on aggregation context and metric', () => {
      const instance = shallow(
        <PromQueryField {...defaultProps} labelKeys={{ foo: ['bar'] }} />
      ).instance() as PromQueryField;
      const result = instance.getTypeahead({
        text: 'job',
        prefix: 'job',
        wrapperClasses: ['context-aggregation'],
        metric: 'foo',
      });
      expect(result.context).toBe('context-aggregation');
      expect(result.suggestions).toEqual([{ items: [{ label: 'bar' }], label: 'Labels' }]);
    });
  });
});
