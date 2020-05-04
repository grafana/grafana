import { mount } from 'enzyme';
// @ts-ignore
import RCCascader from 'rc-cascader';
import React from 'react';
import PromQlLanguageProvider, { DEFAULT_LOOKUP_METRICS_THRESHOLD } from '../language_provider';
import PromQueryField, { groupMetricsByPrefix, RECORDING_RULES_GROUP } from './PromQueryField';

describe('PromQueryField', () => {
  beforeAll(() => {
    // @ts-ignore
    window.getSelection = () => {};
  });

  it('refreshes metrics when the data source changes', async () => {
    const metrics = ['foo', 'bar'];
    const languageProvider = ({
      histogramMetrics: [] as any,
      metrics,
      metricsMetadata: {},
      lookupsDisabled: false,
      lookupMetricsThreshold: DEFAULT_LOOKUP_METRICS_THRESHOLD,
      start: () => {
        return Promise.resolve([]);
      },
    } as unknown) as PromQlLanguageProvider;

    const queryField = mount(
      <PromQueryField
        // @ts-ignore
        datasource={{
          languageProvider,
        }}
        query={{ expr: '', refId: '' }}
        onRunQuery={() => {}}
        onChange={() => {}}
        history={[]}
      />
    );
    await Promise.resolve();

    const cascader = queryField.find<RCCascader>(RCCascader);
    cascader.simulate('click');
    const cascaderNode: HTMLElement = cascader.instance().getPopupDOMNode();

    for (const item of Array.from(cascaderNode.getElementsByTagName('li'))) {
      expect(metrics.includes(item.innerHTML)).toBe(true);
    }

    const changedMetrics = ['baz', 'moo'];
    queryField.setProps({
      datasource: {
        languageProvider: {
          ...languageProvider,
          metrics: changedMetrics,
        },
      },
    });
    await Promise.resolve();

    for (const item of Array.from(cascaderNode.getElementsByTagName('li'))) {
      expect(changedMetrics.includes(item.innerHTML)).toBe(true);
    }
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

  it('returns options grouped by prefix with metadata', () => {
    expect(groupMetricsByPrefix(['foo_metric'], { foo_metric: [{ type: 'TYPE', help: 'my help' }] })).toMatchObject([
      {
        value: 'foo',
        children: [
          {
            value: 'foo_metric',
            title: 'foo_metric\nTYPE\nmy help',
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
