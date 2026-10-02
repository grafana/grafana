import { type AdHocFilterWithLabels } from '@grafana/scenes';

import { getValidBiSelection, stripBiSelectionStamp } from './biSelectionStamp';

const biSelection = { sourcePanel: 'panel-1', values: ['UK', 'FR'] };

describe('getValidBiSelection', () => {
  it('returns the stamp while the filter still holds the written values', () => {
    expect(
      getValidBiSelection({ key: 'country', operator: '=|', value: 'UK', values: ['UK', 'FR'], meta: { biSelection } })
    ).toEqual(biSelection);
    expect(
      getValidBiSelection({
        key: 'country',
        operator: '=',
        value: 'UK',
        meta: { biSelection: { sourcePanel: 'panel-1', values: ['UK'] } },
      })
    ).toEqual({ sourcePanel: 'panel-1', values: ['UK'] });
  });

  it('ignores a stamp whose values no longer match, for example after a pill edit', () => {
    expect(
      getValidBiSelection({ key: 'country', operator: '=|', value: 'UK', values: ['UK', 'DE'], meta: { biSelection } })
    ).toBeUndefined();
    expect(
      getValidBiSelection({ key: 'country', operator: '!=|', value: 'UK', values: ['UK', 'FR'], meta: { biSelection } })
    ).toBeUndefined();
  });

  it('ignores filters without a well-formed stamp', () => {
    expect(getValidBiSelection({ key: 'country', operator: '=', value: 'UK' })).toBeUndefined();
    expect(
      getValidBiSelection({ key: 'country', operator: '=', value: 'UK', meta: { biSelection: { values: ['UK'] } } })
    ).toBeUndefined();
  });
});

describe('stripBiSelectionStamp', () => {
  it('removes the stamp without mutating the filter and keeps other meta', () => {
    const filter: AdHocFilterWithLabels = {
      key: 'country',
      operator: '=|',
      value: 'UK',
      values: ['UK', 'FR'],
      meta: { biSelection, other: 1 },
    };

    expect(stripBiSelectionStamp(filter)).toEqual({
      key: 'country',
      operator: '=|',
      value: 'UK',
      values: ['UK', 'FR'],
      meta: { other: 1 },
    });
    expect(filter.meta).toEqual({ biSelection, other: 1 });
  });

  it('drops meta entirely when the stamp was its only key', () => {
    const stripped = stripBiSelectionStamp({ key: 'country', operator: '=', value: 'UK', meta: { biSelection } });

    expect(stripped).toEqual({ key: 'country', operator: '=', value: 'UK' });
    expect(stripped).not.toHaveProperty('meta');
  });
});
