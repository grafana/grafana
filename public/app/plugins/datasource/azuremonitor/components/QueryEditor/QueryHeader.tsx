import { useCallback, useEffect } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorHeader, FlexItem, InlineSelect } from '@grafana/experimental';
import { reportInteraction } from '@grafana/runtime';
import { Button, RadioButtonGroup } from '@grafana/ui';

import { LogsEditorMode } from '../../dataquery.gen';
import { selectors } from '../../e2e/selectors';
import { AzureMonitorQuery, AzureQueryType } from '../../types';

interface QueryTypeFieldProps {
  query: AzureMonitorQuery;
  onQueryChange: (newQuery: AzureMonitorQuery) => void;
  setAzureLogsCheatSheetModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const EDITOR_MODES = [
  { label: 'Builder', value: LogsEditorMode.Builder },
  { label: 'KQL', value: LogsEditorMode.Raw },
];

export const QueryHeader = ({ query, onQueryChange, setAzureLogsCheatSheetModalOpen }: QueryTypeFieldProps) => {
  const queryTypes: Array<{ value: AzureQueryType; label: string }> = [
    { value: AzureQueryType.AzureMonitor, label: 'Metrics' },
    { value: AzureQueryType.LogAnalytics, label: 'Logs' },
    { value: AzureQueryType.AzureTraces, label: 'Traces' },
    { value: AzureQueryType.AzureResourceGraph, label: 'Azure Resource Graph' },
  ];

  const handleChange = useCallback(
    (change: SelectableValue<AzureQueryType>) => {
      if (change.value && change.value !== query.queryType) {
        onQueryChange({
          ...query,
          queryType: change.value,
        });
      }
    },
    [onQueryChange, query]
  );

  useEffect(() => {
    // Check for the mode property on a logs analytics query, if it's not set default it to Builder
    if (query.azureLogAnalytics && query.azureLogAnalytics.mode === undefined) {
      const updatedQuery = {
        ...query,
        azureLogAnalytics: {
          ...query.azureLogAnalytics,
          mode: LogsEditorMode.Builder,
        },
      };
      onQueryChange(updatedQuery);
    }
  }, [query, onQueryChange]);

  const onLogsModeChange = (newMode: LogsEditorMode) => {
    if (query.azureLogAnalytics) {
      const updatedQuery = {
        ...query,
        azureLogAnalytics: {
          ...query.azureLogAnalytics,
          mode: newMode,
        },
      };
      onQueryChange(updatedQuery);
    }
  };

  return (
    <span data-testid={selectors.components.queryEditor.header.select}>
      <EditorHeader>
        <InlineSelect
          label="Service"
          value={query.queryType === AzureQueryType.TraceExemplar ? AzureQueryType.AzureTraces : query.queryType}
          placeholder="Service..."
          allowCustomValue
          options={queryTypes}
          onChange={handleChange}
        />
        {query.queryType === AzureQueryType.LogAnalytics && query.azureLogAnalytics?.mode === LogsEditorMode.Raw && (
          <Button
            aria-label="Azure logs kick start your query button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setAzureLogsCheatSheetModalOpen((prevValue: boolean) => !prevValue);

              reportInteraction('grafana_azure_logs_query_patterns_opened', {
                version: 'v2',
                editorMode: query.azureLogAnalytics,
              });
            }}
          >
            Kick start your query
          </Button>
        )}
        <FlexItem grow={1} />
        {query.azureLogAnalytics?.mode === LogsEditorMode.Builder && (
          <RadioButtonGroup
            size="sm"
            options={EDITOR_MODES}
            value={query.azureLogAnalytics?.mode || LogsEditorMode.Builder}
            onChange={(newMode: LogsEditorMode) => onLogsModeChange(newMode)}
          />
        )}
      </EditorHeader>
    </span>
  );
};
