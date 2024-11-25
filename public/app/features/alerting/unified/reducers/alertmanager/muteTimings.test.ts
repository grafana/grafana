import { AlertManagerCortexConfig, MuteTimeInterval } from 'app/plugins/datasource/alertmanager/types';

import { addMuteTimingAction, deleteMuteTimingAction, muteTimingsReducer, updateMuteTimingAction } from './muteTimings';

describe('mute timings', () => {
  const initialConfig: AlertManagerCortexConfig = {
    alertmanager_config: {
      time_intervals: [mockTimeInterval({ name: 'default time interval' })],
      mute_time_intervals: [mockTimeInterval({ name: 'default legacy time interval' })],
      route: {
        routes: [
          {
            mute_time_intervals: ['default time interval'],
          },
          {
            mute_time_intervals: ['default legacy time interval'],
          },
        ],
      },
    },
    template_files: {},
  };

  it('should be able to add a new mute timing', () => {
    const newMuteTiming = mockTimeInterval({ name: 'new mute time interval' });
    const action = addMuteTimingAction({ interval: newMuteTiming });

    expect(muteTimingsReducer(initialConfig, action)).toMatchSnapshot();
  });

  it('should be able to remove a mute timing', () => {
    const legacyMuteTimingName = initialConfig.alertmanager_config.mute_time_intervals![0].name;
    const deleteFromLegacyKey = deleteMuteTimingAction({ name: legacyMuteTimingName });
    expect(muteTimingsReducer(initialConfig, deleteFromLegacyKey)).toMatchSnapshot();

    const muteTimingName = initialConfig.alertmanager_config.time_intervals![0].name;
    const deleteMuteTiming = deleteMuteTimingAction({ name: muteTimingName });
    expect(muteTimingsReducer(initialConfig, deleteMuteTiming)).toMatchSnapshot();
  });

  it('should be able to update a time interval', () => {
    const newMuteTiming = mockTimeInterval({ name: 'new mute time interval' });

    const legacyMuteTimingName = initialConfig.alertmanager_config.mute_time_intervals![0].name;
    const updateLegacyMuteTiming = updateMuteTimingAction({
      originalName: legacyMuteTimingName,
      interval: newMuteTiming,
    });
    expect(muteTimingsReducer(initialConfig, updateLegacyMuteTiming)).toMatchSnapshot();

    const muteTimingName = initialConfig.alertmanager_config.time_intervals![0].name;
    const updateMuteTiming = updateMuteTimingAction({ originalName: muteTimingName, interval: newMuteTiming });
    expect(muteTimingsReducer(initialConfig, updateMuteTiming)).toMatchSnapshot();
  });
});

function mockTimeInterval(overrides: Partial<MuteTimeInterval> = {}): MuteTimeInterval {
  return {
    name: 'mock time interval',
    time_intervals: [
      {
        times: [
          {
            start_time: '12:00',
            end_time: '24:00',
          },
        ],
        days_of_month: ['15'],
        months: ['august:december', 'march'],
      },
    ],
    ...overrides,
  };
}
