import { type AdHocFilterWithLabels } from '@grafana/scenes';

import {
  getValidBiSelection,
  hasBiSelectionMeta,
  haveSameExpression,
  releaseBiSelectionStamp,
  releaseIdenticalBiSelection,
  stripBiSelectionStamp,
} from './biSelectionStamp';

const biSelection = { sourcePanel: 'panel-1', key: 'country', values: ['UK', 'FR'] };
const single = { sourcePanel: 'panel-1', key: 'country', values: ['UK'] };

describe('getValidBiSelection', () => {
  it('returns the stamp while the filter still holds the written key and values', () => {
    expect(
      getValidBiSelection({ key: 'country', operator: '=|', value: 'UK', values: ['UK', 'FR'], meta: { biSelection } })
    ).toEqual(biSelection);
    expect(getValidBiSelection({ key: 'country', operator: '=', value: 'UK', meta: { biSelection: single } })).toEqual(
      single
    );
  });

  it('ignores a stamp whose values no longer match, for example after a pill edit', () => {
    expect(
      getValidBiSelection({ key: 'country', operator: '=|', value: 'UK', values: ['UK', 'DE'], meta: { biSelection } })
    ).toBeUndefined();
    expect(
      getValidBiSelection({ key: 'country', operator: '!=|', value: 'UK', values: ['UK', 'FR'], meta: { biSelection } })
    ).toBeUndefined();
  });

  it('ignores a stamp after the filter key was edited', () => {
    expect(getValidBiSelection({ key: 'region', operator: '=', value: 'UK', meta: { biSelection: single } })).toBe(
      undefined
    );
  });

  it('ignores filters without a well-formed stamp', () => {
    expect(getValidBiSelection({ key: 'country', operator: '=', value: 'UK' })).toBeUndefined();
    expect(
      getValidBiSelection({
        key: 'country',
        operator: '=',
        value: 'UK',
        meta: { biSelection: { sourcePanel: 'panel-1', values: ['UK'] } },
      })
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

describe('releaseBiSelectionStamp and hasBiSelectionMeta', () => {
  it('marks a released filter as ordinary, keeps its other meta, and save strips the marker', () => {
    const released = releaseBiSelectionStamp({
      key: 'country',
      operator: '=',
      value: 'UK',
      meta: { biSelection: single, other: 1 },
    });

    expect(released.meta).toEqual({ biSelection: null, other: 1 });
    expect(getValidBiSelection(released)).toBeUndefined();
    expect(hasBiSelectionMeta(released)).toBe(true);
    expect(hasBiSelectionMeta({ key: 'country', operator: '=', value: 'UK' })).toBe(false);
    expect(stripBiSelectionStamp(released)).toEqual({ key: 'country', operator: '=', value: 'UK', meta: { other: 1 } });
  });
});

describe('haveSameExpression', () => {
  it('compares key, operator, value and values only', () => {
    expect(
      haveSameExpression(
        { key: 'country', operator: '=|', value: 'UK', values: ['UK', 'FR'] },
        { key: 'country', operator: '=|', value: 'UK', values: ['UK', 'FR'] }
      )
    ).toBe(true);
    expect(
      haveSameExpression(
        { key: 'country', operator: '=|', value: 'UK', values: ['UK', 'FR'] },
        { key: 'country', operator: '=|', value: 'UK', values: ['UK'] }
      )
    ).toBe(false);
    expect(
      haveSameExpression(
        { key: 'country', operator: '=', value: 'UK' },
        { key: 'country', operator: '!=', value: 'UK' }
      )
    ).toBe(false);
  });
});

describe('releaseIdenticalBiSelection', () => {
  it('releases an identical selection, leaving a marker so it is not restored', () => {
    const other: AdHocFilterWithLabels = { key: 'region', operator: '=', value: 'EU' };
    const filters: AdHocFilterWithLabels[] = [
      other,
      { key: 'country', operator: '=', value: 'UK', meta: { biSelection: single } },
    ];

    expect(releaseIdenticalBiSelection(filters, { key: 'country', operator: '=', value: 'UK' })).toEqual([
      other,
      { key: 'country', operator: '=', value: 'UK', meta: { biSelection: null } },
    ]);
    expect(filters[1].meta).toEqual({ biSelection: single });
  });

  it('returns undefined when no selection matches', () => {
    const filters: AdHocFilterWithLabels[] = [
      { key: 'country', operator: '=', value: 'UK', meta: { biSelection: single } },
      { key: 'region', operator: '=', value: 'EU' },
    ];

    expect(releaseIdenticalBiSelection(filters, { key: 'country', operator: '=', value: 'FR' })).toBeUndefined();
    expect(releaseIdenticalBiSelection(filters, { key: 'region', operator: '=', value: 'EU' })).toBeUndefined();
  });
});
