import { toDataFrame } from '../dataframe';
import { DataFrame, TIME_SERIES_VALUE_FIELD_NAME, FieldType } from '../types';

import { getFieldDisplayName, getFrameDisplayName } from './fieldState';

interface TitleScenario {
  frames: DataFrame[];
  frameIndex?: number; // assume 0
  fieldIndex?: number; // assume 0
}

function checkScenario(scenario: TitleScenario): string {
  const frame = scenario.frames[scenario.frameIndex ?? 0];
  const field = frame.fields[scenario.fieldIndex ?? 0];
  return getFieldDisplayName(field, frame, scenario.frames);
}

describe('getFrameDisplayName', () => {
  it('Should return frame name if set', () => {
    const frame = toDataFrame({
      name: 'Series A',
      fields: [{ name: 'Field 1' }],
    });
    expect(getFrameDisplayName(frame)).toBe('Series A');
  });

  it('Should return field name', () => {
    const frame = toDataFrame({
      fields: [{ name: 'Field 1' }],
    });
    expect(getFrameDisplayName(frame)).toBe('Field 1');
  });

  it('Should return all field names', () => {
    const frame = toDataFrame({
      fields: [{ name: 'Field A' }, { name: 'Field B' }],
    });
    expect(getFrameDisplayName(frame)).toBe('Field A, Field B');
  });

  it('Should return labels if single field with labels', () => {
    const frame = toDataFrame({
      fields: [{ name: 'value', labels: { server: 'A' } }],
    });
    expect(getFrameDisplayName(frame)).toBe('{server="A"}');
  });

  it('Should return field names when labels object exist but has no keys', () => {
    const frame = toDataFrame({
      fields: [{ name: 'value', labels: {} }],
    });
    expect(getFrameDisplayName(frame)).toBe('value');
  });
});

describe('Check field state calculations (displayName and id)', () => {
  it('should use field name if no frame name', () => {
    const title = checkScenario({
      frames: [
        toDataFrame({
          fields: [{ name: 'Field 1' }],
        }),
      ],
    });
    expect(title).toEqual('Field 1');
  });

  it('should use only field name if only one series', () => {
    const title = checkScenario({
      frames: [
        toDataFrame({
          name: 'Series A',
          fields: [{ name: 'Field 1' }],
        }),
      ],
    });
    expect(title).toEqual('Field 1');
  });

  it('should use frame name and field name if more than one frame', () => {
    const title = checkScenario({
      frames: [
        toDataFrame({
          name: 'Series A',
          fields: [{ name: 'Field 1' }],
        }),
        toDataFrame({
          name: 'Series B',
          fields: [{ name: 'Field 1' }],
        }),
      ],
    });
    expect(title).toEqual('Series A Field 1');
  });

  it('should add field name count to name if it exists more than once and is equal to TIME_SERIES_VALUE_FIELD_NAME', () => {
    const title = checkScenario({
      frames: [
        toDataFrame({
          fields: [{ name: TIME_SERIES_VALUE_FIELD_NAME }, { name: TIME_SERIES_VALUE_FIELD_NAME }],
        }),
      ],
    });
    const title2 = checkScenario({
      frames: [
        toDataFrame({
          fields: [{ name: TIME_SERIES_VALUE_FIELD_NAME }, { name: TIME_SERIES_VALUE_FIELD_NAME }],
        }),
      ],
      fieldIndex: 1,
    });

    expect(title).toEqual('Value 1');
    expect(title2).toEqual('Value 2');
  });

  it('should add field name count to name if field name exists more than once', () => {
    const title2 = checkScenario({
      frames: [
        toDataFrame({
          fields: [{ name: 'A' }, { name: 'A' }],
        }),
      ],
      fieldIndex: 1,
    });

    expect(title2).toEqual('A 2');
  });

  it('should only use label value if only one label', () => {
    const title = checkScenario({
      frames: [
        toDataFrame({
          fields: [{ name: 'Value', labels: { server: 'Server A' } }],
        }),
      ],
    });
    expect(title).toEqual('Server A');
  });

  it('should use label value only if all series have same name', () => {
    const title = checkScenario({
      frames: [
        toDataFrame({
          name: 'cpu',
          fields: [{ name: 'Value', labels: { server: 'Server A' } }],
        }),
        toDataFrame({
          name: 'cpu',
          fields: [{ name: 'Value', labels: { server: 'Server A' } }],
        }),
      ],
    });
    expect(title).toEqual('Server A');
  });

  it('should use label name and value if more than one label', () => {
    const title = checkScenario({
      frames: [
        toDataFrame({
          fields: [{ name: 'Value', labels: { server: 'Server A', mode: 'B' } }],
        }),
      ],
    });
    expect(title).toEqual('{mode="B", server="Server A"}');
  });

  it('should use field name even when it is TIME_SERIES_VALUE_FIELD_NAME if there are no labels', () => {
    const title = checkScenario({
      frames: [
        toDataFrame({
          fields: [{ name: TIME_SERIES_VALUE_FIELD_NAME, labels: {} }],
        }),
      ],
    });
    expect(title).toEqual('Value');
  });

  it('should use series name when field name is TIME_SERIES_VALUE_FIELD_NAME and there are no labels ', () => {
    const title = checkScenario({
      frames: [
        toDataFrame({
          name: 'Series A',
          fields: [{ name: TIME_SERIES_VALUE_FIELD_NAME, labels: {} }],
        }),
      ],
    });
    expect(title).toEqual('Series A');
  });

  it('should reder loki frames', () => {
    const title = checkScenario({
      frames: [
        toDataFrame({
          refId: 'A',
          fields: [
            { name: 'time', type: FieldType.time },
            {
              name: 'line',
              labels: { host: 'ec2-13-53-116-156.eu-north-1.compute.amazonaws.com', region: 'eu-north1' },
            },
          ],
        }),
      ],
      fieldIndex: 1,
    });
    expect(title).toEqual('line {host="ec2-13-53-116-156.eu-north-1.compute.amazonaws.com", region="eu-north1"}');
  });
});
