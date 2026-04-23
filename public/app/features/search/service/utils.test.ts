import { type DataFrame, FieldType } from '@grafana/data';
import { type DashboardDataDTO } from 'app/types/dashboard';

import { AnnoKeyUpdatedBy, type Resource, type ResourceList } from '../../apiserver/types';

import { type SearchHit } from './unified';
import { appendFrame, filterSearchResults, resourceToSearchResult } from './utils';

function makeField(name: string, values: unknown[], type = FieldType.string) {
  return { name, type, config: {}, values };
}

function makeFrame(fields: Array<{ name: string; values: unknown[]; type?: FieldType }>, length?: number): DataFrame {
  const f = fields.map(({ name, values, type }) => makeField(name, values, type));
  return { fields: f, length: length ?? (f[0]?.values.length || 0) };
}

describe('appendFrame', () => {
  it('should append frames with identical fields', () => {
    const target = makeFrame([
      { name: 'a', values: [1, 2] },
      { name: 'b', values: ['x', 'y'] },
    ]);
    const frame = makeFrame([
      { name: 'a', values: [3] },
      { name: 'b', values: ['z'] },
    ]);

    appendFrame(target, frame);

    expect(target.length).toBe(3);
    expect(target.fields.find((f) => f.name === 'a')?.values).toEqual([1, 2, 3]);
    expect(target.fields.find((f) => f.name === 'b')?.values).toEqual(['x', 'y', 'z']);
  });

  it('should backfill new fields with null for existing rows', () => {
    const target = makeFrame([{ name: 'a', values: [1, 2] }]);
    const frame = makeFrame([
      { name: 'a', values: [3] },
      { name: 'b', values: ['new'] },
    ]);

    appendFrame(target, frame);

    expect(target.length).toBe(3);
    expect(target.fields.find((f) => f.name === 'a')?.values).toEqual([1, 2, 3]);
    expect(target.fields.find((f) => f.name === 'b')?.values).toEqual([null, null, 'new']);
  });

  it('should pad missing fields with null for new rows', () => {
    const target = makeFrame([
      { name: 'a', values: [1, 2] },
      { name: 'b', values: ['x', 'y'] },
    ]);
    const frame = makeFrame([{ name: 'a', values: [3] }]);

    appendFrame(target, frame);

    expect(target.length).toBe(3);
    expect(target.fields.find((f) => f.name === 'a')?.values).toEqual([1, 2, 3]);
    expect(target.fields.find((f) => f.name === 'b')?.values).toEqual(['x', 'y', null]);
  });

  it('should handle completely disjoint fields', () => {
    const target = makeFrame([{ name: 'a', values: [1, 2] }]);
    const frame = makeFrame([{ name: 'b', values: ['x'] }]);

    appendFrame(target, frame);

    expect(target.length).toBe(3);
    expect(target.fields.find((f) => f.name === 'a')?.values).toEqual([1, 2, null]);
    expect(target.fields.find((f) => f.name === 'b')?.values).toEqual([null, null, 'x']);
  });

  it('should handle multiple appends with varying fields', () => {
    const target = makeFrame([{ name: 'a', values: [1] }]);

    // Second page introduces field 'b'
    appendFrame(
      target,
      makeFrame([
        { name: 'a', values: [2] },
        { name: 'b', values: ['x'] },
      ])
    );
    expect(target.length).toBe(2);
    expect(target.fields.find((f) => f.name === 'a')?.values).toEqual([1, 2]);
    expect(target.fields.find((f) => f.name === 'b')?.values).toEqual([null, 'x']);

    // Third page introduces field 'c', drops 'b'
    appendFrame(
      target,
      makeFrame([
        { name: 'a', values: [3] },
        { name: 'c', values: [true] },
      ])
    );
    expect(target.length).toBe(3);
    expect(target.fields.find((f) => f.name === 'a')?.values).toEqual([1, 2, 3]);
    expect(target.fields.find((f) => f.name === 'b')?.values).toEqual([null, 'x', null]);
    expect(target.fields.find((f) => f.name === 'c')?.values).toEqual([null, null, true]);
  });

  it('should handle appending an empty frame', () => {
    const target = makeFrame([{ name: 'a', values: [1, 2] }]);
    const frame = makeFrame([], 0);

    appendFrame(target, frame);

    expect(target.length).toBe(2);
    expect(target.fields.find((f) => f.name === 'a')?.values).toEqual([1, 2]);
  });

  it('should handle appending to an empty target', () => {
    const target = makeFrame([], 0);
    const frame = makeFrame([{ name: 'a', values: [1] }]);

    appendFrame(target, frame);

    expect(target.length).toBe(1);
    expect(target.fields.find((f) => f.name === 'a')?.values).toEqual([1]);
  });
});

function makeDeletedItem(opts: { name: string; title?: string; deletedByUid?: string }): Resource<DashboardDataDTO> {
  const annotations: Record<string, string> = {};
  if (opts.deletedByUid !== undefined) {
    annotations[AnnoKeyUpdatedBy] = opts.deletedByUid;
  }
  return {
    apiVersion: 'dashboard.grafana.app/v1beta1',
    kind: 'Dashboard',
    metadata: {
      name: opts.name,
      resourceVersion: '1',
      creationTimestamp: '2024-01-01T00:00:00Z',
      deletionTimestamp: '2024-06-01T00:00:00Z',
      annotations,
    },
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    spec: { title: opts.title ?? opts.name, uid: opts.name } as DashboardDataDTO,
  };
}

function makeResourceList(items: Array<Resource<DashboardDataDTO>>): ResourceList<DashboardDataDTO> {
  return {
    apiVersion: 'dashboard.grafana.app/v1beta1',
    kind: 'DashboardList',
    metadata: { resourceVersion: '0' },
    items,
  };
}

describe('resourceToSearchResult', () => {
  it('extracts the grafana.app/updatedBy annotation as field.deletedBy', () => {
    const list = makeResourceList([makeDeletedItem({ name: 'a', deletedByUid: 'user:alice' })]);

    const [hit] = resourceToSearchResult(list);

    expect(hit.field.deletedBy).toBe('user:alice');
  });

  it('leaves field.deletedBy unset when the annotation is missing', () => {
    const list = makeResourceList([makeDeletedItem({ name: 'a' })]);

    const [hit] = resourceToSearchResult(list);

    expect(hit.field.deletedBy).toBeUndefined();
  });

  it('resolves the UID through the display map when available', () => {
    const list = makeResourceList([makeDeletedItem({ name: 'a', deletedByUid: 'user:alice' })]);
    const displayMap = new Map<string, string>([['user:alice', 'Alice']]);

    const [hit] = resourceToSearchResult(list, displayMap);

    expect(hit.field.deletedBy).toBe('Alice');
  });

  it('falls back to the raw UID when the display map has no matching entry', () => {
    const list = makeResourceList([makeDeletedItem({ name: 'a', deletedByUid: 'user:bob' })]);
    const displayMap = new Map<string, string>([['user:alice', 'Alice']]);

    const [hit] = resourceToSearchResult(list, displayMap);

    expect(hit.field.deletedBy).toBe('user:bob');
  });
});

describe('filterSearchResults deletedby sort', () => {
  function makeHit(title: string, deletedBy?: string): SearchHit {
    const field: Record<string, string | number> = {};
    if (deletedBy !== undefined) {
      field.deletedBy = deletedBy;
    }
    return {
      resource: 'dashboards',
      name: title.toLowerCase(),
      title,
      location: 'general',
      folder: 'general',
      tags: [],
      field,
      url: '',
    };
  }

  it('sorts ascending by field.deletedBy', () => {
    const hits = [makeHit('A', 'Carla'), makeHit('B', 'Alice'), makeHit('C', 'Bob')];

    const sorted = filterSearchResults([...hits], { sort: 'deletedby-asc' });

    expect(sorted.map((h) => h.title)).toEqual(['B', 'C', 'A']);
  });

  it('sorts descending by field.deletedBy', () => {
    const hits = [makeHit('A', 'Carla'), makeHit('B', 'Alice'), makeHit('C', 'Bob')];

    const sorted = filterSearchResults([...hits], { sort: 'deletedby-desc' });

    expect(sorted.map((h) => h.title)).toEqual(['A', 'C', 'B']);
  });

  it('sends hits without a deletedBy value to the end in both directions', () => {
    const hits = [makeHit('A'), makeHit('B', 'Alice'), makeHit('C'), makeHit('D', 'Bob')];

    const asc = filterSearchResults([...hits], { sort: 'deletedby-asc' });
    expect(asc.map((h) => h.title)).toEqual(['B', 'D', 'A', 'C']);

    const desc = filterSearchResults([...hits], { sort: 'deletedby-desc' });
    expect(desc.map((h) => h.title)).toEqual(['D', 'B', 'A', 'C']);
  });
});
