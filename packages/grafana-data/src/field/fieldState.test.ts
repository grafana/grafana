import { DataFrame, FieldState, TIME_SERIES_FIELD_NAME, FieldType } from '../types';
import { getFieldState } from './fieldState';
import { toDataFrame } from '../dataframe';

interface TitleScenario {
  frames: DataFrame[];
  frameIndex?: number; // assume 0
  fieldIndex?: number; // assume 0
}

function checkScenario(scenario: TitleScenario): FieldState {
  const frame = scenario.frames[scenario.frameIndex ?? 0];
  const field = frame.fields[scenario.fieldIndex ?? 0];
  return getFieldState(field, frame, scenario.frames);
}

describe('Check field state calculations (title and id)', () => {
  it('should use field name if no frame name', () => {
    const state = checkScenario({
      frames: [
        toDataFrame({
          fields: [{ name: 'Field 1' }],
        }),
      ],
    });
    expect(state.title).toEqual('Field 1');
  });

  it('should use only field name if only one series', () => {
    const state = checkScenario({
      frames: [
        toDataFrame({
          name: 'Series A',
          fields: [{ name: 'Field 1' }],
        }),
      ],
    });
    expect(state.title).toEqual('Field 1');
  });

  it('should use frame name and field name if more than one frame', () => {
    const state = checkScenario({
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
    expect(state.title).toEqual('Series A Field 1');
  });

  it('should only use label value if only one label', () => {
    const state = checkScenario({
      frames: [
        toDataFrame({
          fields: [{ name: 'Value', labels: { server: 'Server A' } }],
        }),
      ],
    });
    expect(state.title).toEqual('Server A');
  });

  it('should use label value only if all series have same name', () => {
    const state = checkScenario({
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
    expect(state.title).toEqual('Server A');
  });

  it('should use label name and value if more than one label', () => {
    const state = checkScenario({
      frames: [
        toDataFrame({
          fields: [{ name: 'Value', labels: { server: 'Server A', mode: 'B' } }],
        }),
      ],
    });
    expect(state.title).toEqual('{mode="B", server="Server A"}');
  });

  it('should use field name even when it is TIME_SERIES_FIELD_NAME if there are no labels', () => {
    const state = checkScenario({
      frames: [
        toDataFrame({
          fields: [{ name: TIME_SERIES_FIELD_NAME, labels: {} }],
        }),
      ],
    });
    expect(state.title).toEqual('Value');
  });

  it('should use series name when field name is TIME_SERIES_FIELD_NAME and there are no labels ', () => {
    const state = checkScenario({
      frames: [
        toDataFrame({
          name: 'Series A',
          fields: [{ name: TIME_SERIES_FIELD_NAME, labels: {} }],
        }),
      ],
    });
    expect(state.title).toEqual('Series A');
  });

  it('should reder loki frames', () => {
    const state = checkScenario({
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
    expect(state.title).toEqual('line {host="ec2-13-53-116-156.eu-north-1.compute.amazonaws.com", region="eu-north1"}');
  });
});
