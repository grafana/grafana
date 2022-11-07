import { toDataFrame, FieldType } from '@grafana/data';

import { partitionByValuesTransformer, PartitionByValuesTransformerOptions } from './partitionByValues';

describe('Partition by values transformer', () => {
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
    };

    let partitioned = partitionByValuesTransformer.transformer(config)(source);

    expect(partitioned.length).toEqual(2);

    expect(partitioned[0].length).toEqual(3);
    expect(partitioned[0].name).toEqual('Europe');
    expect(partitioned[0].fields[0].name).toEqual('model');
    expect(partitioned[0].fields[1].name).toEqual('region');
    expect(partitioned[0].fields[0].values.toArray()).toEqual(['E1', 'E2', 'E3']);
    expect(partitioned[0].fields[1].values.toArray()).toEqual(['Europe', 'Europe', 'Europe']);

    expect(partitioned[1].length).toEqual(3);
    expect(partitioned[1].name).toEqual('China');
    expect(partitioned[1].fields[0].name).toEqual('model');
    expect(partitioned[1].fields[1].name).toEqual('region');
    expect(partitioned[1].fields[0].values.toArray()).toEqual(['C1', 'C2', 'C3']);
    expect(partitioned[1].fields[1].values.toArray()).toEqual(['China', 'China', 'China']);
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
    };

    let partitioned = partitionByValuesTransformer.transformer(config)(source);

    expect(partitioned.length).toEqual(4);

    expect(partitioned[0].length).toEqual(1);
    expect(partitioned[0].name).toEqual('Europe OK');
    expect(partitioned[0].fields[0].name).toEqual('model');
    expect(partitioned[0].fields[1].name).toEqual('region');
    expect(partitioned[0].fields[2].name).toEqual('status');
    expect(partitioned[0].fields[0].values.toArray()).toEqual(['E1']);
    expect(partitioned[0].fields[1].values.toArray()).toEqual(['Europe']);
    expect(partitioned[0].fields[2].values.toArray()).toEqual(['OK']);

    expect(partitioned[1].length).toEqual(2);
    expect(partitioned[1].name).toEqual('Europe FAIL');
    expect(partitioned[1].fields[0].name).toEqual('model');
    expect(partitioned[1].fields[1].name).toEqual('region');
    expect(partitioned[1].fields[2].name).toEqual('status');
    expect(partitioned[1].fields[0].values.toArray()).toEqual(['E2', 'E3']);
    expect(partitioned[1].fields[1].values.toArray()).toEqual(['Europe', 'Europe']);
    expect(partitioned[1].fields[2].values.toArray()).toEqual(['FAIL', 'FAIL']);

    expect(partitioned[2].length).toEqual(2);
    expect(partitioned[2].name).toEqual('China OK');
    expect(partitioned[2].fields[0].name).toEqual('model');
    expect(partitioned[2].fields[1].name).toEqual('region');
    expect(partitioned[2].fields[2].name).toEqual('status');
    expect(partitioned[2].fields[0].values.toArray()).toEqual(['C1', 'C2']);
    expect(partitioned[2].fields[1].values.toArray()).toEqual(['China', 'China']);
    expect(partitioned[2].fields[2].values.toArray()).toEqual(['OK', 'OK']);

    expect(partitioned[3].length).toEqual(1);
    expect(partitioned[3].name).toEqual('China FAIL');
    expect(partitioned[3].fields[0].name).toEqual('model');
    expect(partitioned[3].fields[1].name).toEqual('region');
    expect(partitioned[3].fields[2].name).toEqual('status');
    expect(partitioned[3].fields[0].values.toArray()).toEqual(['C3']);
    expect(partitioned[3].fields[1].values.toArray()).toEqual(['China']);
    expect(partitioned[3].fields[2].values.toArray()).toEqual(['FAIL']);
  });

  it('should partition by multiple fields with custom frame naming {withFields: true}', () => {
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
      naming: {
        withFields: true,
      },
    };

    let partitioned = partitionByValuesTransformer.transformer(config)(source);

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
      naming: {
        append: true,
      },
    };

    let partitioned = partitionByValuesTransformer.transformer(config)(source);

    expect(partitioned[0].name).toEqual('XYZ Europe OK');
    expect(partitioned[1].name).toEqual('XYZ Europe FAIL');
    expect(partitioned[2].name).toEqual('XYZ China OK');
    expect(partitioned[3].name).toEqual('XYZ China FAIL');
  });

  it('should partition by multiple fields with custom frame naming {withFields: true, append: true}', () => {
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
      naming: {
        withFields: true,
        append: true,
      },
    };

    let partitioned = partitionByValuesTransformer.transformer(config)(source);

    expect(partitioned[0].name).toEqual('XYZ region=Europe status=OK');
    expect(partitioned[1].name).toEqual('XYZ region=Europe status=FAIL');
    expect(partitioned[2].name).toEqual('XYZ region=China status=OK');
    expect(partitioned[3].name).toEqual('XYZ region=China status=FAIL');
  });
});
