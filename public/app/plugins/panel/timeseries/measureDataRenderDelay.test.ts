import { measureDataRenderDelay } from './measureDataRenderDelay';
import { FieldType, toDataFrame } from '@grafana/data';
import { MeasurementName } from 'app/core/services/LivePerformance';

const mockMeasurementFn = jest.fn();
jest.mock('app/core/services/LivePerformance', () => {
  const originalModule = jest.requireActual('app/core/services/LivePerformance');

  return {
    ...originalModule,
    LivePerformance: {
      instance: () => ({
        add: mockMeasurementFn,
      }),
    },
  };
});

jest.useFakeTimers();

describe('measureDataRenderDelay', () => {
  const currentTime = 1000;

  beforeAll(() => {
    jest.spyOn(Date, 'now').mockReturnValue(currentTime);
  });

  beforeEach(() => {
    mockMeasurementFn.mockClear();
  });

  const frameWith = (timeValues: number[]) => [
    toDataFrame({
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: timeValues,
        },
      ],
    }),
  ];

  it('should measure the delay between the creation and the render of the most recently added data point', async () => {
    const timeValues = [100, 200, 300];
    measureDataRenderDelay(frameWith([...timeValues, 400]), frameWith(timeValues));
    expect(mockMeasurementFn).toHaveBeenCalledWith(MeasurementName.DataRenderDelay, 600);
  });

  it('should work for mutated frames which keep the same references for time values', async () => {
    const timeValues = [100, 200, 300];
    const frame = frameWith(timeValues);

    measureDataRenderDelay(frame, frame);
    expect(mockMeasurementFn).not.toHaveBeenCalled(); // first call should result in no measurements - we don't know which values were the most recent

    measureDataRenderDelay(frame, frame);
    expect(mockMeasurementFn).not.toHaveBeenCalled(); // no changes -> no measurements

    timeValues.push(500);
    measureDataRenderDelay(frame, frame);
    expect(mockMeasurementFn).toHaveBeenCalledTimes(1);
    expect(mockMeasurementFn).toHaveBeenCalledWith(MeasurementName.DataRenderDelay, 500);
  });
});
