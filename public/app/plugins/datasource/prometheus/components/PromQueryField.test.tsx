import { groupMetricsByPrefix, RECORDING_RULES_GROUP } from './PromQueryField';

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
