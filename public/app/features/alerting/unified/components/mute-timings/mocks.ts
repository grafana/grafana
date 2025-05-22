import { AlertManagerCortexConfig, MuteTimeInterval } from 'app/plugins/datasource/alertmanager/types';

export const muteTimeInterval: MuteTimeInterval = {
  name: 'default-mute',
  time_intervals: [
    {
      times: [
        {
          start_time: '12:00',
          end_time: '24:00',
        },
      ],
      days_of_month: ['15', '-1'],
      months: ['august:december', 'march'],
    },
  ],
};
/** Alertmanager config where time intervals are stored in `mute_time_intervals` property */
export const defaultConfig: AlertManagerCortexConfig = {
  alertmanager_config: {
    receivers: [{ name: 'default' }, { name: 'critical' }],
    route: {
      receiver: 'default',
      group_by: ['alertname'],
      routes: [
        {
          matchers: ['env=prod', 'region!=EU'],
          mute_time_intervals: [muteTimeInterval.name],
        },
      ],
    },
    templates: [],
    mute_time_intervals: [muteTimeInterval],
  },
  template_files: {},
};
