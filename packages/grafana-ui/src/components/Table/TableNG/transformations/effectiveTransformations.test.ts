import { lastValueFrom } from 'rxjs';

import {
  type DataFrame,
  type DataTransformerConfig,
  DataTransformerID,
  FieldType,
  FrameMatcherID,
  LoadingState,
  toDataFrame,
  transformDataFrame,
} from '@grafana/data';
import {
  type FilterByValueConfig,
  FilterByValueMatch,
  FilterByValueType,
  filterByValueTransformer,
  mockTransformationsRegistry,
  organizeFieldsTransformer,
} from '@grafana/data/internal';

import { getEffectiveTableTransformations } from './effectiveTransformations';

mockTransformationsRegistry([filterByValueTransformer, organizeFieldsTransformer]);

const DONE = LoadingState.Done;

const VALUES: Record<string, unknown[]> = {
  service: ['api', 'web', 'db'],
  region: ['eu', 'us', 'eu'],
  latency: [10, 20, 30],
  errors: [1, 5, 0],
};

function services(refId = 'A', names = ['service', 'region', 'errors']): DataFrame {
  return toDataFrame({
    refId,
    fields: names.map((name) => ({
      name,
      type: typeof VALUES[name][0] === 'number' ? FieldType.number : FieldType.string,
      values: VALUES[name],
    })),
  });
}

function columns(options: object, refId = 'A'): DataTransformerConfig {
  return {
    id: DataTransformerID.organize,
    options: { indexByName: {}, excludeByName: {}, renameByName: {}, ...options },
    filter: { id: FrameMatcherID.byRefId, options: refId },
  };
}

function rowFilter(fieldName: string, target: object = {}): FilterByValueConfig {
  return {
    id: DataTransformerID.filterByValue,
    options: {
      type: FilterByValueType.include,
      match: FilterByValueMatch.all,
      missingField: 'ignore',
      target: { frameKey: 'services', frameIndex: 0, refId: 'A', ...target },
      filters: [
        {
          fieldName,
          field: { name: fieldName },
          config: { id: 'inSet', options: { values: ['api'], mode: 'display' } },
        },
      ],
    },
  };
}

async function view(transformations: DataTransformerConfig[], series: DataFrame[]) {
  const frames = await lastValueFrom(transformDataFrame(transformations, series));
  return frames.map((frame) => ({
    refId: frame.refId,
    fields: frame.fields.map(({ name, values }) => ({ name, values })),
  }));
}

describe('getEffectiveTableTransformations', () => {
  it('keeps hidden columns, column orders and filters that still apply', () => {
    const transformations = [
      rowFilter('service'),
      columns({ excludeByName: { errors: true, service: true }, indexByName: { errors: 0, service: 1, region: 2 } }),
    ];

    expect(getEffectiveTableTransformations(transformations, [services()], DONE)).toEqual(transformations);
  });

  it('drops hidden columns, orders and filters for fields that are no longer in the data', () => {
    const result = getEffectiveTableTransformations(
      [
        rowFilter('zone'),
        columns({ excludeByName: { region: true, zone: true }, indexByName: { zone: 0, gone: 1 } }),
        columns({ excludeByName: { gone: true } }, 'B'),
      ],
      [services(), services('B')],
      DONE
    );

    expect(result).toEqual([columns({ excludeByName: { region: true } })]);
  });

  it('drops changes for a query that no longer returns a frame', () => {
    const result = getEffectiveTableTransformations(
      [rowFilter('service', { frameIndex: 1, refId: 'B' }), columns({ excludeByName: { service: true } }, 'B')],
      [services()],
      DONE
    );

    expect(result).toEqual([]);
  });

  it('keeps changes for frames that have not arrived while the data is loading, but checks the frames that have', () => {
    const notArrived = [
      rowFilter('service', { frameIndex: 1, refId: 'B' }),
      columns({ excludeByName: { service: true } }, 'B'),
    ];

    const result = getEffectiveTableTransformations(
      [...notArrived, columns({ excludeByName: { zone: true } })],
      [services()],
      LoadingState.Loading
    );

    expect(result).toEqual(notArrived);
  });

  it('checks each column entry against the frame of its own query, wherever that frame now is', () => {
    const latency = columns({ excludeByName: { latency: true } }, 'B');

    const result = getEffectiveTableTransformations(
      [columns({ excludeByName: { latency: true } }), latency],
      [services('B', ['service', 'latency']), services('A')],
      DONE
    );

    expect(result).toEqual([latency]);
  });

  it('drops a column order that matches the order of the data', () => {
    const result = getEffectiveTableTransformations(
      [columns({ excludeByName: { region: true }, indexByName: { service: 0, region: 1, errors: 2 } })],
      [services()],
      DONE
    );

    expect(result).toEqual([columns({ excludeByName: { region: true } })]);
  });

  it('records the full order the table shows when columns were added after reordering', async () => {
    const series = [services('A', ['latency', 'service', 'region', 'errors'])];

    const result = getEffectiveTableTransformations(
      [columns({ indexByName: { errors: 0, service: 1, region: 2 } })],
      series,
      DONE
    );

    expect(result).toEqual([columns({ indexByName: { errors: 0, latency: 1, service: 2, region: 3 } })]);
    const [frame] = await view(result, series);
    expect(frame.fields.map(({ name }) => name)).toEqual(['errors', 'latency', 'service', 'region']);
  });

  it('keeps only the known part of an order that applies to several frames', () => {
    const order = (indexByName: Record<string, number>) => ({
      id: DataTransformerID.organize,
      options: { indexByName },
    });

    const result = getEffectiveTableTransformations(
      [order({ errors: 0, service: 1, region: 2, gone: 3 })],
      [services(), services('B')],
      DONE
    );

    expect(result).toEqual([order({ errors: 0, service: 1, region: 2 })]);
  });

  it('keeps only the known part of an order when the data has duplicate column names', () => {
    const series = [
      toDataFrame({
        refId: 'A',
        fields: [
          { name: 'service', type: FieldType.string, values: ['api'] },
          { name: 'p50', type: FieldType.number, values: [1], config: { displayName: 'latency' } },
          { name: 'p99', type: FieldType.number, values: [2], config: { displayName: 'latency' } },
        ],
      }),
    ];

    const result = getEffectiveTableTransformations(
      [columns({ indexByName: { latency: 0, service: 1, gone: 2 } })],
      series,
      DONE
    );

    expect(result).toEqual([columns({ indexByName: { latency: 0, service: 1 } })]);
  });

  it('leaves the transformed data unchanged when it drops changes that no longer apply', async () => {
    const series = [services(), services('B', ['service', 'latency'])];
    const transformations = [
      rowFilter('service'),
      rowFilter('zone'),
      rowFilter('latency', { frameIndex: 2, refId: 'C' }),
      columns({
        excludeByName: { region: true, zone: true },
        indexByName: { errors: 0, service: 1, region: 2, zone: 3 },
      }),
      columns({ indexByName: { service: 0, latency: 1 } }, 'B'),
      columns({ excludeByName: { latency: true } }, 'C'),
    ];

    const effective = getEffectiveTableTransformations(transformations, series, DONE);

    expect(effective).toHaveLength(2);
    expect(await view(effective, series)).toEqual(await view(transformations, series));
  });

  it('keeps nested row filters only while their parent row is still there', () => {
    const child = (values: string[]) => toDataFrame({ fields: [{ name: 'status', type: FieldType.string, values }] });
    const series = [
      toDataFrame({
        refId: 'A',
        fields: [
          { name: 'host', type: FieldType.string, values: ['a', 'b'] },
          { name: 'checks', type: FieldType.nestedFrames, values: [[child(['ok', 'fail'])], [child(['ok'])]] },
        ],
      }),
    ];
    const nested = (parentIndex: number, parentKey?: string) => rowFilter('status', { parentIndex, parentKey });

    const result = getEffectiveTableTransformations(
      [nested(0, '["a"]'), nested(0, '["b"]'), nested(2, '["c"]'), nested(1), nested(2)],
      series,
      DONE
    );

    expect(result).toEqual([nested(0, '["a"]'), nested(1)]);
  });

  it('checks a filter without a target against every frame', () => {
    const anyFrame = (fieldName: string) => {
      const filter = rowFilter(fieldName);
      delete filter.options.target;
      return filter;
    };

    const result = getEffectiveTableTransformations(
      [anyFrame('latency'), anyFrame('zone')],
      [services(), services('B', ['service', 'latency'])],
      DONE
    );

    expect(result).toEqual([anyFrame('latency')]);
  });

  it('matches a filter target without a frame index or query to the first frame', () => {
    const firstFrame = rowFilter('service', { frameIndex: undefined, refId: undefined });

    expect(getEffectiveTableTransformations([firstFrame, rowFilter('service')], [services('B')], DONE)).toEqual([
      firstFrame,
    ]);
  });

  it('finds filtered fields by name and labels, or by display name when the filter has no field identity', () => {
    const series = [
      toDataFrame({
        refId: 'A',
        fields: [
          { name: 'service', type: FieldType.string, values: ['api'] },
          { name: 'value', type: FieldType.number, values: [1], labels: { host: 'a' } },
        ],
      }),
    ];
    const byLabels = (host: string) => {
      const filter = rowFilter('value');
      filter.options.filters[0].field = { name: 'value', labels: { host } };
      return filter;
    };
    const byDisplayName = (fieldName: string) => {
      const filter = rowFilter(fieldName);
      delete filter.options.filters[0].field;
      return filter;
    };

    const result = getEffectiveTableTransformations(
      [byLabels('a'), byLabels('b'), byDisplayName('service'), byDisplayName('Service')],
      series,
      DONE
    );

    expect(result).toEqual([byLabels('a'), byDisplayName('service')]);
  });

  it('keeps a filter that removes every row while its frame is there', () => {
    const removesEveryRow = rowFilter('zone');
    delete removesEveryRow.options.missingField;
    const otherQuery = rowFilter('zone', { frameIndex: 1, refId: 'B' });
    delete otherQuery.options.missingField;

    expect(getEffectiveTableTransformations([removesEveryRow, otherQuery], [services()], DONE)).toEqual([
      removesEveryRow,
    ]);
  });

  it('ignores disabled and empty entries', () => {
    const emptyFilter = rowFilter('service');
    emptyFilter.options.filters = [];

    const result = getEffectiveTableTransformations(
      [
        { ...columns({ excludeByName: { region: true } }), disabled: true },
        columns({ excludeByName: { region: false } }),
        emptyFilter,
        { id: DataTransformerID.organize, options: undefined },
        { id: DataTransformerID.filterByValue, options: undefined },
      ],
      [services()],
      DONE
    );

    expect(result).toEqual([]);
  });

  it('keeps changes it cannot check against the data as they are', () => {
    const calculated = { id: 'calculateField', options: { alias: 'total' } };
    const renamed = columns({ excludeByName: { zone: true }, renameByName: { service: 'Service' } });
    const unknownScope = { ...columns({ excludeByName: { zone: true } }), filter: { id: 'unknown', options: 'A' } };
    const scopedFilter = { ...rowFilter('zone'), filter: { id: FrameMatcherID.byRefId, options: 'A' } };
    const transformations = [calculated, renamed, unknownScope, scopedFilter];

    expect(getEffectiveTableTransformations(transformations, [services()], DONE)).toEqual(transformations);
  });

  it('keeps every change until the panel has data to check them against', () => {
    const transformations = [
      rowFilter('zone'),
      columns({ excludeByName: { zone: true }, indexByName: { b: 0, a: 1 } }),
    ];

    expect(getEffectiveTableTransformations(transformations, [], DONE)).toEqual(transformations);
  });
});
