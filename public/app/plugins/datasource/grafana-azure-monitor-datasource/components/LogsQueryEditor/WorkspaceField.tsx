import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { AzureQueryEditorFieldProps, AzureMonitorOption } from '../../types';
import { findOption, toOption } from '../../utils/common';
import { Field } from '../Field';

const ERROR_SOURCE = 'logs-workspaces';
const WorkspaceField: React.FC<AzureQueryEditorFieldProps> = ({
  query,
  datasource,
  subscriptionId,
  variableOptionGroup,
  onQueryChange,
  setError,
}) => {
  const [workspaces, setWorkspaces] = useState<AzureMonitorOption[]>([]);

  useEffect(() => {
    if (!subscriptionId) {
      workspaces.length > 0 && setWorkspaces([]);
      return;
    }

    datasource
      .getAzureLogAnalyticsWorkspaces(subscriptionId)
      .then((results) => {
        setWorkspaces(results.map(toOption));
      })
      .catch((err) => setError(ERROR_SOURCE, err));
  }, [datasource, setError, subscriptionId, workspaces.length]);

  const handleChange = useCallback(
    (change: SelectableValue<string>) => {
      if (!change.value) {
        return;
      }

      onQueryChange({
        ...query,
        azureLogAnalytics: {
          ...query.azureLogAnalytics,
          workspace: change.value,
        },
      });
    },
    [onQueryChange, query]
  );

  const options = useMemo(() => [...workspaces, variableOptionGroup], [workspaces, variableOptionGroup]);

  return (
    <Field label="Workspace">
      <Select
        inputId="azure-monitor-logs-workspaces-field"
        value={findOption(workspaces, query.azureLogAnalytics.workspace)}
        onChange={handleChange}
        options={options}
        width={38}
      />
    </Field>
  );
};

export default WorkspaceField;
