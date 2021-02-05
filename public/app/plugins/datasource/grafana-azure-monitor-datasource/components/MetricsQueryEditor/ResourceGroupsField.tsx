import React, { useEffect, useState } from 'react';
import { Select } from '@grafana/ui';

import { Field } from '../Field';
import { findOption, MetricsQueryEditorFieldProps, Option, toOption } from '../common';

const ResourceGroupsField: React.FC<MetricsQueryEditorFieldProps> = ({
  query,
  datasource,
  subscriptionId,
  onChange,
}) => {
  const [options, setOptions] = useState<Option[]>([]);

  useEffect(() => {
    if (!subscriptionId) {
      return;
    }

    datasource
      .getResourceGroups(subscriptionId)
      .then((results) => setOptions(results.map(toOption)))
      .catch((err) => {
        // TODO: handle error
        console.error(err);
      });
  }, [subscriptionId]);

  return (
    <Field label="Resource Group" labelWidth={16}>
      <Select
        value={findOption(options, query.azureMonitor.resourceGroup)}
        onChange={(v) => v.value && onChange('resourceGroup', v.value)}
        options={options}
        width={38}
      />
    </Field>
  );
};

export default ResourceGroupsField;
