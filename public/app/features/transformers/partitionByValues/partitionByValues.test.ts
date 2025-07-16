import { toDataFrame, FieldType } from '@grafana/data';

import { getPartitionByValuesTransformer, PartitionByValuesTransformerOptions } from './partitionByValues';

const ctx = {
  interpolate: (v: string) => v,
};

describe('Partition by values transformer', () => {
  const partitionByValuesTransformer = getPartitionByValuesTransformer();

  it('should partition by one field', () => {
    const source = [
      toDataFrame({
        name: 'XYZ',
        refId: 'A',
        fields: [
          { name: 'model', type: FieldType.string, values: ['E1', 'E2', 'C1', 'E3', 'C2', 'C3'] },
          { name: 'region', type: FieldType.string, values: ['Europe', 'Europe', 'China', 'Europe', 'China', 'China'] },
        ],
      }),
    ];

    const config: PartitionByValuesTransformerOptions = {
      fields: ['region'],
      keepFields: true,
      naming: {
        asLabels: false,
      },
    };

    let partitioned = partitionByValuesTransformer.transformer(config, ctx)(source);

    expect(partitioned.length).toEqual(2);

    expect(partitioned[0].length).toEqual(3);
    expect(partitioned[0].name).toEqual('Europe');
    expect(partitioned[0].fields[0].name).toEqual('model');
    expect(partitioned[0].fields[1].name).toEqual('region');
    expect(partitioned[0].fields[0].values).toEqual(['E1', 'E2', 'E3']);
    expect(partitioned[0].fields[1].values).toEqual(['Europe', 'Europe', 'Europe']);

    expect(partitioned[1].length).toEqual(3);
    expect(partitioned[1].name).toEqual('China');
    expect(partitioned[1].fields[0].name).toEqual('model');
    expect(partitioned[1].fields[1].name).toEqual('region');
    expect(partitioned[1].fields[0].values).toEqual(['C1', 'C2', 'C3']);
    expect(partitioned[1].fields[1].values).toEqual(['China', 'China', 'China']);
  });

  it('should partition by multiple fields', () => {
    const source = [
      toDataFrame({
        name: 'XYZ',
        refId: 'A',
        fields: [
          { name: 'model', type: FieldType.string, values: ['E1', 'E2', 'C1', 'E3', 'C2', 'C3'] },
          { name: 'region', type: FieldType.string, values: ['Europe', 'Europe', 'China', 'Europe', 'China', 'China'] },
          { name: 'status', type: FieldType.string, values: ['OK', 'FAIL', 'OK', 'FAIL', 'OK', 'FAIL'] },
        ],
      }),
    ];

    const config: PartitionByValuesTransformerOptions = {
      fields: ['region', 'status'],
      keepFields: true,
      naming: {
        asLabels: false,
      },
    };

    let partitioned = partitionByValuesTransformer.transformer(config, ctx)(source);

    expect(partitioned.length).toEqual(4);

    expect(partitioned[0].length).toEqual(1);
    expect(partitioned[0].name).toEqual('Europe OK');
    expect(partitioned[0].fields[0].name).toEqual('model');
    expect(partitioned[0].fields[1].name).toEqual('region');
    expect(partitioned[0].fields[2].name).toEqual('status');
    expect(partitioned[0].fields[0].values).toEqual(['E1']);
    expect(partitioned[0].fields[1].values).toEqual(['Europe']);
    expect(partitioned[0].fields[2].values).toEqual(['OK']);

    expect(partitioned[1].length).toEqual(2);
    expect(partitioned[1].name).toEqual('Europe FAIL');
    expect(partitioned[1].fields[0].name).toEqual('model');
    expect(partitioned[1].fields[1].name).toEqual('region');
    expect(partitioned[1].fields[2].name).toEqual('status');
    expect(partitioned[1].fields[0].values).toEqual(['E2', 'E3']);
    expect(partitioned[1].fields[1].values).toEqual(['Europe', 'Europe']);
    expect(partitioned[1].fields[2].values).toEqual(['FAIL', 'FAIL']);

    expect(partitioned[2].length).toEqual(2);
    expect(partitioned[2].name).toEqual('China OK');
    expect(partitioned[2].fields[0].name).toEqual('model');
    expect(partitioned[2].fields[1].name).toEqual('region');
    expect(partitioned[2].fields[2].name).toEqual('status');
    expect(partitioned[2].fields[0].values).toEqual(['C1', 'C2']);
    expect(partitioned[2].fields[1].values).toEqual(['China', 'China']);
    expect(partitioned[2].fields[2].values).toEqual(['OK', 'OK']);

    expect(partitioned[3].length).toEqual(1);
    expect(partitioned[3].name).toEqual('China FAIL');
    expect(partitioned[3].fields[0].name).toEqual('model');
    expect(partitioned[3].fields[1].name).toEqual('region');
    expect(partitioned[3].fields[2].name).toEqual('status');
    expect(partitioned[3].fields[0].values).toEqual(['C3']);
    expect(partitioned[3].fields[1].values).toEqual(['China']);
    expect(partitioned[3].fields[2].values).toEqual(['FAIL']);
  });

  it('should partition by multiple fields with custom frame naming {withNames: true}', () => {
    const source = [
      toDataFrame({
        name: 'XYZ',
        refId: 'A',
        fields: [
          { name: 'model', type: FieldType.string, values: ['E1', 'E2', 'C1', 'E3', 'C2', 'C3'] },
          { name: 'region', type: FieldType.string, values: ['Europe', 'Europe', 'China', 'Europe', 'China', 'China'] },
          { name: 'status', type: FieldType.string, values: ['OK', 'FAIL', 'OK', 'FAIL', 'OK', 'FAIL'] },
        ],
      }),
    ];

    const config: PartitionByValuesTransformerOptions = {
      fields: ['region', 'status'],
      keepFields: true,
      naming: {
        asLabels: false,
        withNames: true,
      },
    };

    let partitioned = partitionByValuesTransformer.transformer(config, ctx)(source);

    expect(partitioned[0].name).toEqual('region=Europe status=OK');
    expect(partitioned[1].name).toEqual('region=Europe status=FAIL');
    expect(partitioned[2].name).toEqual('region=China status=OK');
    expect(partitioned[3].name).toEqual('region=China status=FAIL');
  });

  it('should partition by multiple fields with custom frame naming {append: true}', () => {
    const source = [
      toDataFrame({
        name: 'XYZ',
        refId: 'A',
        fields: [
          { name: 'model', type: FieldType.string, values: ['E1', 'E2', 'C1', 'E3', 'C2', 'C3'] },
          { name: 'region', type: FieldType.string, values: ['Europe', 'Europe', 'China', 'Europe', 'China', 'China'] },
          { name: 'status', type: FieldType.string, values: ['OK', 'FAIL', 'OK', 'FAIL', 'OK', 'FAIL'] },
        ],
      }),
    ];

    const config: PartitionByValuesTransformerOptions = {
      fields: ['region', 'status'],
      keepFields: true,
      naming: {
        asLabels: false,
        append: true,
      },
    };

    let partitioned = partitionByValuesTransformer.transformer(config, ctx)(source);

    expect(partitioned[0].name).toEqual('XYZ Europe OK');
    expect(partitioned[1].name).toEqual('XYZ Europe FAIL');
    expect(partitioned[2].name).toEqual('XYZ China OK');
    expect(partitioned[3].name).toEqual('XYZ China FAIL');
  });

  it('should partition by multiple fields with custom frame naming {withNames: true, append: true}', () => {
    const source = [
      toDataFrame({
        name: 'XYZ',
        refId: 'A',
        fields: [
          { name: 'model', type: FieldType.string, values: ['E1', 'E2', 'C1', 'E3', 'C2', 'C3'] },
          { name: 'region', type: FieldType.string, values: ['Europe', 'Europe', 'China', 'Europe', 'China', 'China'] },
          { name: 'status', type: FieldType.string, values: ['OK', 'FAIL', 'OK', 'FAIL', 'OK', 'FAIL'] },
        ],
      }),
    ];

    const config: PartitionByValuesTransformerOptions = {
      fields: ['region', 'status'],
      keepFields: true,
      naming: {
        asLabels: false,
        withNames: true,
        append: true,
      },
    };

    let partitioned = partitionByValuesTransformer.transformer(config, ctx)(source);

    expect(partitioned[0].name).toEqual('XYZ region=Europe status=OK');
    expect(partitioned[1].name).toEqual('XYZ region=Europe status=FAIL');
    expect(partitioned[2].name).toEqual('XYZ region=China status=OK');
    expect(partitioned[3].name).toEqual('XYZ region=China status=FAIL');
  });

  it('should partition by multiple fields naming: {asLabels: true}', () => {
    const source = [
      toDataFrame({
        name: 'XYZ',
        refId: 'A',
        fields: [
          { name: 'model', type: FieldType.string, values: ['E1', 'E2', 'C1', 'E3', 'C2', 'C3'] },
          { name: 'region', type: FieldType.string, values: ['Europe', 'Europe', 'China', 'Europe', 'China', 'China'] },
          { name: 'status', type: FieldType.string, values: ['OK', 'FAIL', 'OK', 'FAIL', 'OK', 'FAIL'] },
        ],
      }),
    ];

    const config: PartitionByValuesTransformerOptions = {
      fields: ['region', 'status'],
      keepFields: true,
      naming: {
        asLabels: true,
      },
    };

    let partitioned = partitionByValuesTransformer.transformer(config, ctx)(source);

    // all frame names are same
    expect(partitioned[0].name).toEqual('XYZ');
    expect(partitioned[1].name).toEqual('XYZ');
    expect(partitioned[2].name).toEqual('XYZ');
    expect(partitioned[3].name).toEqual('XYZ');

    // all frames contain all fields
    expect(partitioned[0].fields[0].name).toEqual('model');
    expect(partitioned[0].fields[1].name).toEqual('region');
    expect(partitioned[0].fields[2].name).toEqual('status');

    // in each frame, every field has same labels
    expect(partitioned[0].fields[0].labels).toEqual({ region: 'Europe', status: 'OK' });
    expect(partitioned[1].fields[0].labels).toEqual({ region: 'Europe', status: 'FAIL' });
    expect(partitioned[2].fields[0].labels).toEqual({ region: 'China', status: 'OK' });
    expect(partitioned[3].fields[0].labels).toEqual({ region: 'China', status: 'FAIL' });
  });

  it('should partition by multiple fields and omit those fields in result', () => {
    const source = [
      toDataFrame({
        name: 'XYZ',
        refId: 'A',
        fields: [
          { name: 'model', type: FieldType.string, values: ['E1', 'E2', 'C1', 'E3', 'C2', 'C3'] },
          { name: 'region', type: FieldType.string, values: ['Europe', 'Europe', 'China', 'Europe', 'China', 'China'] },
          { name: 'status', type: FieldType.string, values: ['OK', 'FAIL', 'OK', 'FAIL', 'OK', 'FAIL'] },
        ],
      }),
    ];

    const config: PartitionByValuesTransformerOptions = {
      fields: ['region', 'status'],
    };

    let partitioned = partitionByValuesTransformer.transformer(config, ctx)(source);

    // all frames contain only model field
    expect(partitioned[0].fields.length).toEqual(1);
    expect(partitioned[0].fields[0].name).toEqual('model');
    expect(partitioned[0].fields[0].labels).toEqual({ region: 'Europe', status: 'OK' });
  });
});
