import React, { useEffect, useState } from 'react';

import { InlineField, Select } from '@grafana/ui';
import { findOption, MetricsQueryEditorFieldProps, Options, toOption } from '../common';

const ResourceNameField: React.FC<MetricsQueryEditorFieldProps> = ({
  query,
  datasource,
  subscriptionId,
  replaceTemplateVariable,
  onChange,
}) => {
  const [options, setOptions] = useState<Options>([]);
  const azureMonitorIsConfigured = datasource.azureMonitorDatasource.isConfigured();

  useEffect(() => {
    if (!(azureMonitorIsConfigured && query.azureMonitor.resourceGroup && query.azureMonitor.metricDefinition)) {
      return;
    }

    datasource
      .getResourceNames(
        replaceTemplateVariable(subscriptionId),
        replaceTemplateVariable(query.azureMonitor.resourceGroup),
        replaceTemplateVariable(query.azureMonitor.metricDefinition)
      )
      .then((results) => setOptions(results.map(toOption)))
      .catch((err) => {
        // TODO: handle error
        console.error(err);
      });
  }, [subscriptionId, query.azureMonitor.resourceGroup, query.azureMonitor.metricDefinition]);

  return (
    <InlineField label="Resource Name" labelWidth={16}>
      <Select
        value={findOption(options, query.azureMonitor.resourceName)}
        onChange={(v) => onChange('resourceName', v)}
        options={options}
      />
    </InlineField>
  );
};

export default ResourceNameField;
