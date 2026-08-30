import { getFieldDisplayName } from '../field/fieldState';
import { type Labels } from '../types/data';
import { type DataFrame, FieldType } from '../types/dataFrame';

import {
  parseLabels,
  formatLabels,
  findCommonLabels,
  findUniqueLabels,
  matchAllLabels,
  extractFacetedLabels,
  resolveFacetedFilterNames,
  FIELD_NAME_FACET_KEY,
} from './labels';

describe('parseLabels()', () => {
  it('returns no labels on empty labels string', () => {
    expect(parseLabels('')).toEqual({});
    expect(parseLabels('{}')).toEqual({});
  });

  it('returns labels on labels string', () => {
    expect(parseLabels('{foo="bar", baz="42"}')).toEqual({ foo: 'bar', baz: '42' });
  });
});

describe('formatLabels()', () => {
  it('returns no labels on empty label set', () => {
    expect(formatLabels({})).toEqual('');
    expect(formatLabels({}, 'foo')).toEqual('foo');
  });

  it('returns label string on label set', () => {
    expect(formatLabels({ foo: 'bar', baz: '42' })).toEqual('{baz="42", foo="bar"}');
  });
});

describe('findCommonLabels()', () => {
  it('returns no common labels on empty sets', () => {
    expect(findCommonLabels([{}])).toEqual({});
    expect(findCommonLabels([{}, {}])).toEqual({});
  });

  it('returns no common labels on differing sets', () => {
    expect(findCommonLabels([{ foo: 'bar' }, {}])).toEqual({});
    expect(findCommonLabels([{}, { foo: 'bar' }])).toEqual({});
    expect(findCommonLabels([{ baz: '42' }, { foo: 'bar' }])).toEqual({});
    expect(findCommonLabels([{ foo: '42', baz: 'bar' }, { foo: 'bar' }])).toEqual({});
  });

  it('returns the single labels set as common labels', () => {
    expect(findCommonLabels([{ foo: 'bar' }])).toEqual({ foo: 'bar' });
  });
});

describe('findUniqueLabels()', () => {
  it('returns no uncommon labels on empty sets', () => {
    expect(findUniqueLabels({}, {})).toEqual({});
  });

  it('returns all labels given no common labels', () => {
    expect(findUniqueLabels({ foo: '"bar"' }, {})).toEqual({ foo: '"bar"' });
  });

  it('returns all labels except the common labels', () => {
    expect(findUniqueLabels({ foo: '"bar"', baz: '"42"' }, { foo: '"bar"' })).toEqual({ baz: '"42"' });
  });
});

describe('matchAllLabels()', () => {
  it('empty labels do math', () => {
    expect(matchAllLabels({}, {})).toBeTruthy();
  });

  it('missing labels', () => {
    expect(matchAllLabels({ foo: 'bar' }, {})).toBeFalsy();
  });

  it('extra labels should match', () => {
    expect(matchAllLabels({ foo: 'bar' }, { foo: 'bar', baz: '22' })).toBeTruthy();
  });

  it('be graceful with null values (match)', () => {
    expect(matchAllLabels({ foo: 'bar' })).toBeFalsy();
  });

  it('be graceful with null values (match)', () => {
    expect(matchAllLabels(undefined as unknown as Labels, { foo: 'bar' })).toBeTruthy();
  });
});

function makeFrame(fields: Array<{ name?: string; labels?: Labels; type?: FieldType }>, frameName = 'test'): DataFrame {
  return {
    name: frameName,
    length: 0,
    fields: fields.map((f) => ({
      name: f.name ?? 'value',
      type: f.type ?? FieldType.number,
      config: {},
      values: [],
      labels: f.labels,
    })),
  };
}

describe('extractFacetedLabels()', () => {
  it('returns empty object for empty input', () => {
    expect(extractFacetedLabels([])).toEqual({});
  });

  it('skips time fields', () => {
    const frame = makeFrame([{ type: FieldType.time }, { labels: { job: 'grafana' } }]);
    expect(extractFacetedLabels([frame])).toEqual({ job: ['grafana'] });
  });

  it('collects deduplicated sorted values across frames, skipping unlabeled fields', () => {
    const frame1 = makeFrame([
      { labels: { job: 'grafana', instance: 'localhost:3000' } },
      {},
      { labels: { job: 'grafana', instance: 'localhost:3001' } },
    ]);
    const frame2 = makeFrame([{ labels: { job: 'prometheus', instance: 'localhost:9090' } }]);

    expect(extractFacetedLabels([frame1, frame2])).toEqual({
      job: ['grafana', 'prometheus'],
      instance: ['localhost:3000', 'localhost:3001', 'localhost:9090'],
    });
  });

  it('adds __name__ facet when fields have multiple distinct names', () => {
    const frame = makeFrame([
      { name: 'cpu', labels: { host: 'a' } },
      { name: 'mem', labels: { host: 'a' } },
    ]);
    const result = extractFacetedLabels([frame]);
    expect(result[FIELD_NAME_FACET_KEY]).toEqual(['cpu', 'mem']);
    expect(result.host).toEqual(['a']);
  });

  it('omits __name__ facet when all fields share the same name', () => {
    const frame = makeFrame([
      { name: 'cpu', labels: { host: 'a' } },
      { name: 'cpu', labels: { host: 'b' } },
    ]);
    expect(extractFacetedLabels([frame])).toEqual({ host: ['a', 'b'] });
    expect(extractFacetedLabels([frame])[FIELD_NAME_FACET_KEY]).toBeUndefined();
  });

  it('falls back to frame names when all fields share the same raw name', () => {
    const frames = [
      makeFrame([{ name: 'Value' }], 'io'),
      makeFrame([{ name: 'Value' }], 'ir'),
      makeFrame([{ name: 'Value' }], 'ov'),
    ];
    const result = extractFacetedLabels(frames);
    expect(result[FIELD_NAME_FACET_KEY]).toEqual(['io', 'ir', 'ov']);
  });
});

describe('resolveFacetedFilterNames()', () => {
  const frames: DataFrame[] = [
    makeFrame([
      { name: 'cpu', labels: { host: 'a', region: 'us' } },
      { name: 'cpu', labels: { host: 'b', region: 'eu' } },
    ]),
    makeFrame([
      { name: 'mem', labels: { host: 'a', region: 'us' } },
      { name: 'mem', labels: { host: 'b', region: 'eu' } },
    ]),
  ];

  it('returns null when selection is empty', () => {
    expect(resolveFacetedFilterNames(frames, {}, getFieldDisplayName)).toBeNull();
  });

  it('returns null when all selected arrays are empty', () => {
    expect(resolveFacetedFilterNames(frames, { host: [], region: [] }, getFieldDisplayName)).toBeNull();
  });

  it('applies OR within a single key', () => {
    const result = resolveFacetedFilterNames(frames, { host: ['a', 'b'] }, getFieldDisplayName);
    expect(result).toEqual([
      'cpu {host="a", region="us"}',
      'cpu {host="b", region="eu"}',
      'mem {host="a", region="us"}',
      'mem {host="b", region="eu"}',
    ]);
  });

  it('applies AND across different keys', () => {
    const result = resolveFacetedFilterNames(frames, { host: ['a'], region: ['eu'] }, getFieldDisplayName);
    expect(result).toEqual([]);
  });

  it('matches fields using the __name__ facet by field name', () => {
    const result = resolveFacetedFilterNames(frames, { [FIELD_NAME_FACET_KEY]: ['cpu'] }, getFieldDisplayName);
    expect(result).toEqual(['cpu {host="a", region="us"}', 'cpu {host="b", region="eu"}']);
  });

  it('matches __name__ facet by frame name when fields share the same raw name', () => {
    const multiQueryFrames = [makeFrame([{ name: 'Value' }], 'io'), makeFrame([{ name: 'Value' }], 'ir')];
    const result = resolveFacetedFilterNames(multiQueryFrames, { [FIELD_NAME_FACET_KEY]: ['io'] }, getFieldDisplayName);
    expect(result).toEqual(['io']);
  });

  it('combines __name__ and label filters with AND', () => {
    const result = resolveFacetedFilterNames(
      frames,
      {
        [FIELD_NAME_FACET_KEY]: ['mem'],
        host: ['b'],
      },
      getFieldDisplayName
    );
    expect(result).toEqual(['mem {host="b", region="eu"}']);
  });

  it('excludes fields without the selected label key', () => {
    const mixedFrames = [makeFrame([{ name: 'cpu', labels: { host: 'a' } }, { name: 'unlabeled' }])];
    const result = resolveFacetedFilterNames(mixedFrames, { host: ['a'] }, getFieldDisplayName);
    expect(result).toHaveLength(1);
    expect(result![0]).toContain('cpu');
    expect(result).not.toContainEqual(expect.stringContaining('unlabeled'));
  });
});
