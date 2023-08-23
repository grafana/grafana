import React from 'react';

import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { ConfigSubSection } from '@grafana/experimental';
import { InlineField, InlineSwitch } from '@grafana/ui';
import { ConfigDescriptionLink } from 'app/core/components/ConfigDescriptionLink';

export function AlertingSettings({
  options,
  onOptionsChange,
}: Pick<DataSourcePluginOptionsEditorProps, 'options' | 'onOptionsChange'>) {
  return (
    <ConfigSubSection title="Alerting" description={
        <ConfigDescriptionLink
          description="Manage alert rules for the Loki data source."
          suffix="loki/configure-loki-data-source/#alerting"
          feature="alerting"
        />
      }>
      <InlineField
        labelWidth={29}
        label="Manage alert rules in Alerting UI"
        disabled={options.readOnly}
        tooltip="Manage alert rules for this data source. To manage other alerting resources, add an Alertmanager data source."
      >
        <InlineSwitch
          value={options.jsonData.manageAlerts !== false}
          onChange={(event) =>
            onOptionsChange({
              ...options,
              jsonData: { ...options.jsonData, manageAlerts: event!.currentTarget.checked },
            })
          }
        />
      </InlineField>
    </ConfigSubSection>
  );
}
