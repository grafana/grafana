import React, { useMemo } from 'react';

import { PanelPlugin } from '@grafana/data';
import { Options } from '@grafana/schema/src/raw/composable/alertgroups/panelcfg/x/AlertGroupsPanelCfg_types.gen';
import { AlertManagerPicker } from 'app/features/alerting/unified/components/AlertManagerPicker';
import {
  getAllAlertManagerDataSources,
  GRAFANA_RULES_SOURCE_NAME,
} from 'app/features/alerting/unified/utils/datasource';

import { AlertGroupsPanel } from './AlertGroupsPanel';

export const plugin = new PanelPlugin<Options>(AlertGroupsPanel).setPanelOptions((builder) => {
  return builder
    .addCustomEditor({
      name: 'Alertmanager',
      path: 'alertmanager',
      id: 'alertmanager',
      defaultValue: GRAFANA_RULES_SOURCE_NAME,
      category: ['Options'],
      editor: function RenderAlertmanagerPicker(props) {
        const alertManagers = useMemo(getAllAlertManagerDataSources, []);

        return (
          <AlertManagerPicker
            current={props.value}
            onChange={(alertManagerSourceName) => {
              return props.onChange(alertManagerSourceName);
            }}
            dataSources={alertManagers}
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
