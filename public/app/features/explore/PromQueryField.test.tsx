import React from 'react';
import Enzyme, { shallow } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';
import Plain from 'slate-plain-serializer';

import PromQueryField, { groupMetricsByPrefix, RECORDING_RULES_GROUP } from './PromQueryField';

Enzyme.configure({ adapter: new Adapter() });

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
      const value = Plain.deserialize('{}');
      const range = value.selection.merge({
        anchorOffset: 1,
      });
      const valueWithSelection = value.change().select(range).value;
      const result = instance.getTypeahead({
        text: '',
        prefix: '',
        wrapperClasses: ['context-labels'],
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-labels');
      expect(result.suggestions).toEqual([{ items: [{ label: 'job' }, { label: 'instance' }], label: 'Labels' }]);
    });

    it('returns label suggestions on label context and metric', () => {
      const instance = shallow(
        <PromQueryField {...defaultProps} labelKeys={{ '{__name__="metric"}': ['bar'] }} />
      ).instance() as PromQueryField;
      const value = Plain.deserialize('metric{}');
      const range = value.selection.merge({
        anchorOffset: 7,
      });
      const valueWithSelection = value.change().select(range).value;
      const result = instance.getTypeahead({
        text: '',
        prefix: '',
        wrapperClasses: ['context-labels'],
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-labels');
      expect(result.suggestions).toEqual([{ items: [{ label: 'bar' }], label: 'Labels' }]);
    });

    it('returns label suggestions on label context but leaves out labels that already exist', () => {
      const instance = shallow(
        <PromQueryField
          {...defaultProps}
          labelKeys={{ '{job1="foo",job2!="foo",job3=~"foo"}': ['bar', 'job1', 'job2', 'job3'] }}
        />
      ).instance() as PromQueryField;
      const value = Plain.deserialize('{job1="foo",job2!="foo",job3=~"foo",}');
      const range = value.selection.merge({
        anchorOffset: 36,
      });
      const valueWithSelection = value.change().select(range).value;
      const result = instance.getTypeahead({
        text: '',
        prefix: '',
        wrapperClasses: ['context-labels'],
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-labels');
      expect(result.suggestions).toEqual([{ items: [{ label: 'bar' }], label: 'Labels' }]);
    });

    it('returns label value suggestions inside a label value context after a negated matching operator', () => {
      const instance = shallow(
        <PromQueryField
          {...defaultProps}
          labelKeys={{ '{}': ['label'] }}
          labelValues={{ '{}': { label: ['a', 'b', 'c'] } }}
        />
      ).instance() as PromQueryField;
      const value = Plain.deserialize('{label!=}');
      const range = value.selection.merge({ anchorOffset: 8 });
      const valueWithSelection = value.change().select(range).value;
      const result = instance.getTypeahead({
        text: '!=',
        prefix: '',
        wrapperClasses: ['context-labels'],
        labelKey: 'label',
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-label-values');
      expect(result.suggestions).toEqual([
        {
          items: [{ label: 'a' }, { label: 'b' }, { label: 'c' }],
          label: 'Label values for "label"',
        },
      ]);
    });

    it('returns a refresher on label context and unavailable metric', () => {
      const instance = shallow(
        <PromQueryField {...defaultProps} labelKeys={{ '{__name__="foo"}': ['bar'] }} />
      ).instance() as PromQueryField;
      const value = Plain.deserialize('metric{}');
      const range = value.selection.merge({
        anchorOffset: 7,
      });
      const valueWithSelection = value.change().select(range).value;
      const result = instance.getTypeahead({
        text: '',
        prefix: '',
        wrapperClasses: ['context-labels'],
        value: valueWithSelection,
      });
      expect(result.context).toBeUndefined();
      expect(result.refresher).toBeInstanceOf(Promise);
      expect(result.suggestions).toEqual([]);
    });

    it('returns label values on label context when given a metric and a label key', () => {
      const instance = shallow(
        <PromQueryField
          {...defaultProps}
          labelKeys={{ '{__name__="metric"}': ['bar'] }}
          labelValues={{ '{__name__="metric"}': { bar: ['baz'] } }}
        />
      ).instance() as PromQueryField;
      const value = Plain.deserialize('metric{bar=ba}');
      const range = value.selection.merge({
        anchorOffset: 13,
      });
      const valueWithSelection = value.change().select(range).value;
      const result = instance.getTypeahead({
        text: '=ba',
        prefix: 'ba',
        wrapperClasses: ['context-labels'],
        labelKey: 'bar',
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-label-values');
      expect(result.suggestions).toEqual([{ items: [{ label: 'baz' }], label: 'Label values for "bar"' }]);
    });

    it('returns label suggestions on aggregation context and metric w/ selector', () => {
      const instance = shallow(
        <PromQueryField {...defaultProps} labelKeys={{ '{__name__="metric",foo="xx"}': ['bar'] }} />
      ).instance() as PromQueryField;
      const value = Plain.deserialize('sum(metric{foo="xx"}) by ()');
      const range = value.selection.merge({
        anchorOffset: 26,
      });
      const valueWithSelection = value.change().select(range).value;
      const result = instance.getTypeahead({
        text: '',
        prefix: '',
        wrapperClasses: ['context-aggregation'],
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-aggregation');
      expect(result.suggestions).toEqual([{ items: [{ label: 'bar' }], label: 'Labels' }]);
    });

    it('returns label suggestions on aggregation context and metric w/o selector', () => {
      const instance = shallow(
        <PromQueryField {...defaultProps} labelKeys={{ '{__name__="metric"}': ['bar'] }} />
      ).instance() as PromQueryField;
      const value = Plain.deserialize('sum(metric) by ()');
      const range = value.selection.merge({
        anchorOffset: 16,
      });
      const valueWithSelection = value.change().select(range).value;
      const result = instance.getTypeahead({
        text: '',
        prefix: '',
        wrapperClasses: ['context-aggregation'],
        value: valueWithSelection,
      });
      expect(result.context).toBe('context-aggregation');
      expect(result.suggestions).toEqual([{ items: [{ label: 'bar' }], label: 'Labels' }]);
    });
  });
});

describe('groupMetricsByPrefix()', () => {
  it('returns an empty group for no metrics', () => {
    expect(groupMetricsByPrefix([])).toEqual([]);
  });

  it('returns options grouped by prefix', () => {
    expect(groupMetricsByPrefix(['foo_metric'])).toMatchObject([
      {
        value: 'foo',
        children: [
          {
            value: 'foo_metric',
          },
        ],
      },
    ]);
  });

  it('returns options without prefix as toplevel option', () => {
    expect(groupMetricsByPrefix(['metric'])).toMatchObject([
      {
        value: 'metric',
      },
    ]);
  });

  it('returns recording rules grouped separately', () => {
    expect(groupMetricsByPrefix([':foo_metric:'])).toMatchObject([
      {
        value: RECORDING_RULES_GROUP,
        children: [
          {
            value: ':foo_metric:',
          },
        ],
      },
    ]);
  });
});
