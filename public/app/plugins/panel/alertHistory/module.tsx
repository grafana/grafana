import { PanelPlugin } from '@grafana/data';
import { Select } from '@grafana/ui';
import { StateFilterValues } from 'app/features/alerting/unified/components/rules/central-state-history/CentralAlertHistoryScene';

import { AlertHistoryPanel } from './AlertHistory';
import { AlertHistoryOptions } from './types';

const alertHistory = new PanelPlugin<AlertHistoryOptions>(AlertHistoryPanel).setPanelOptions((builder) => {
  builder
    .addBooleanSwitch({
      path: 'hideEventsGraph',
      name: 'Hide events graph',
      description: 'Hide the graph displaying the events',
      defaultValue: false,
      category: ['Options'],
    })
    .addBooleanSwitch({
      path: 'hideEventsList',
      name: 'Hide events list',
      description: 'Hide the table displaying the list of events',
      defaultValue: false,
      category: ['Options'],
    })
    .addCustomEditor({
      path: 'filterFrom',
      name: 'filterFrom',
      description: 'Filter to state',
      id: 'filterFrom',
      defaultValue: StateFilterValues.all,
      editor: function RenderStateOptions(props) {
        return (
          <Select
            options={[
              { label: StateFilterValues.all, value: StateFilterValues.all },
              { label: StateFilterValues.firing, value: StateFilterValues.firing },
              { label: StateFilterValues.pending, value: StateFilterValues.pending },
              { label: StateFilterValues.normal, value: StateFilterValues.normal },
            ]}
            defaultValue={StateFilterValues.all}
            value={props.value}
            onChange={(e) => props.onChange(e.value)}
          />
        );
      },
      category: ['Filter'],
    })
    .addCustomEditor({
      path: 'filterTo',
      name: 'filterTo',
      description: 'Filter to state',
      id: 'filterTo',
      defaultValue: StateFilterValues.all,
      editor: function RenderStateOptions(props) {
        return (
          <Select
            options={[
              { label: StateFilterValues.all, value: StateFilterValues.all },
              { label: StateFilterValues.firing, value: StateFilterValues.firing },
              { label: StateFilterValues.pending, value: StateFilterValues.pending },
              { label: StateFilterValues.normal, value: StateFilterValues.normal },
            ]}
            defaultValue={StateFilterValues.all}
            value={props.value}
            onChange={(e) => {
              props.onChange(e.value);
            }}
          />
        );
      },
      category: ['Filter'],
    });
});

export const plugin = alertHistory;
