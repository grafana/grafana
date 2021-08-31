import React from 'react';
import { PanelPlugin } from '@grafana/data';
import { AlertGroupPanelOptions } from './types';
import { AlertGroupsPanel } from './AlertGroupsPanel';
import { AlertManagerPicker } from 'app/features/alerting/unified/components/AlertManagerPicker';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';

export const plugin = new PanelPlugin<AlertGroupPanelOptions>(AlertGroupsPanel).setPanelOptions((builder) => {
  return builder
    .addCustomEditor({
      name: 'Alertmanager',
      path: 'alertmanager',
      id: 'alertmanager',
      defaultValue: GRAFANA_RULES_SOURCE_NAME,
      category: ['Options'],
      editor: function RenderAlertmanagerPicker(props) {
        return (
          <AlertManagerPicker
            current={props.value}
            onChange={(alertManagerSourceName) => {
              return props.onChange(alertManagerSourceName);
            }}
          />
        );
      },
    })
    .addBooleanSwitch({
      name: 'Expand all by default',
      path: 'expandAll',
      defaultValue: false,
      category: ['Options'],
    })
    .addTextInput({
      description: 'Filter results by matching labels, ex: env=production,severity=~critical|warning',
      name: 'Labels',
      path: 'labels',
      category: ['Filter'],
    });
});
