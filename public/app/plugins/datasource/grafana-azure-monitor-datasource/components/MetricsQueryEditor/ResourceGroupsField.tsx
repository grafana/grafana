import React, { useEffect, useState } from 'react';

import { InlineField, Select } from '@grafana/ui';
import { findOption, MetricsQueryEditorFieldProps, Options, toOption } from '../common';

const ResourceGroupsField: React.FC<MetricsQueryEditorFieldProps> = ({
  query,
  datasource,
  subscriptionId,
  onChange,
}) => {
  const [options, setOptions] = useState<Options>([]);
  const azureMonitorIsConfigured = datasource.azureMonitorDatasource.isConfigured();

  useEffect(() => {
    if (!azureMonitorIsConfigured) {
      return;
    }

    datasource
      .getResourceGroups(datasource.replace(subscriptionId))
      .then((results) => setOptions(results.map(toOption)))
      .catch((err) => {
        // TODO: handle error
        console.error(err);
      });
  }, [azureMonitorIsConfigured, subscriptionId]);

  return (
    <InlineField label="Resource Group" labelWidth={16}>
      <Select
        value={findOption(options, query.azureMonitor.resourceGroup)}
        onChange={(v) => onChange('resourceGroup', v)}
        options={options}
      />
    </InlineField>
  );
};

export default ResourceGroupsField;
