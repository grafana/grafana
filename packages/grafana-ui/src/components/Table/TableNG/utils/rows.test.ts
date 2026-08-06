import { createDataFrame, FieldType, type DataFrame } from '@grafana/data';

import { getDisplayName } from './fields';
import { compileFrameToRecords } from './rows';

describe('frame to records conversion', () => {
  it('should convert DataFrame to TableRows', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'time', values: [1, 2] },
        { name: 'value', values: [10, 20] },
      ],
    });

    const frameToRecords = compileFrameToRecords(frame.fields.map(getDisplayName));
    const records = frameToRecords(frame);
    expect(records).toHaveLength(2);
    // Columns are exposed via prototype getters, not own properties, so assert with
    // toMatchObject (walks the prototype chain) rather than toEqual (own-props only).
    expect(records[0]).toMatchObject({ __depth: 0, __index: 0, time: 1, value: 10 });
  });

  it('should handle nested frames', () => {
    const childFrame1 = createDataFrame({
      fields: [
        { name: 'time', values: [1, 2] },
        { name: 'value', values: [10, 20] },
      ],
    });
    const childFrame2 = createDataFrame({
      fields: [
        { name: 'time', values: [3, 4] },
        { name: 'value', values: [30, 40] },
      ],
    });
    const parentFrame = createDataFrame({
      fields: [
        { name: 'id', values: [100, 200] },
        { name: 'nested', values: [[childFrame1], [childFrame2]], type: FieldType.nestedFrames },
      ],
    });

    const frameToRecords = compileFrameToRecords(parentFrame.fields.map(getDisplayName), 'nested');
    const records = frameToRecords(parentFrame);
    expect(records).toHaveLength(4);
    expect(records[0]).toMatchObject({ __depth: 0, __index: 0, id: 100 });
    expect(records[1]).toEqual({ __depth: 1, __index: 0 });
    expect(records[2]).toMatchObject({ __depth: 0, __index: 1, id: 200 });
    expect(records[3]).toEqual({ __depth: 1, __index: 1 });
  });

  it('should render a nested row correctly', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'time', values: [1, 2] },
        { name: 'value', values: [10, 20] },
      ],
    });

    const frameToRecords = compileFrameToRecords(frame.fields.map(getDisplayName));
    const records = frameToRecords(frame, 3);

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ __depth: 0, __index: 0, __parentIndex: 3, time: 1, value: 10 });
    expect(records[1]).toMatchObject({ __depth: 0, __index: 1, __parentIndex: 3, time: 2, value: 20 });
  });

  it('should infer length from field values when frame.length is not set', () => {
    const frame: DataFrame = {
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3], config: {} },
        { name: 'value', type: FieldType.number, values: [10, 20, 30], config: {} },
      ],
    } as unknown as DataFrame;

    const frameToRecords = compileFrameToRecords(frame.fields.map(getDisplayName));
    const records = frameToRecords(frame);

    expect(records).toHaveLength(3);
    expect(records[0]).toMatchObject({ __depth: 0, __index: 0, time: 1, value: 10 });
    expect(records[1]).toMatchObject({ __depth: 0, __index: 1, time: 2, value: 20 });
    expect(records[2]).toMatchObject({ __depth: 0, __index: 2, time: 3, value: 30 });
  });

  it('should produce no rows when frame.length is not set and the nested frame has no fields', () => {
    const frame: DataFrame = {
      fields: [],
    } as unknown as DataFrame;

    const frameToRecords = compileFrameToRecords(frame.fields.map(getDisplayName));
    const records = frameToRecords(frame, 3);

    expect(records).toHaveLength(0);
  });
});
