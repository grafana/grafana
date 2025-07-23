import { useCallback, useEffect, useMemo, useState } from 'react';

import { CoreApp, LoadingState, PanelData, SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { EditorHeader, FlexItem, InlineSelect } from '@grafana/plugin-ui';
import { config, reportInteraction } from '@grafana/runtime';
import { Button, ConfirmModal, RadioButtonGroup } from '@grafana/ui';

import { LogsEditorMode } from '../../dataquery.gen';
import { selectors } from '../../e2e/selectors';
import { AzureMonitorQuery, AzureQueryType } from '../../types/query';

interface QueryTypeFieldProps {
  query: AzureMonitorQuery;
  onQueryChange: (newQuery: AzureMonitorQuery) => void;
  setAzureLogsCheatSheetModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  data: PanelData | undefined;
  onRunQuery: () => void;
  app: CoreApp | undefined;
}

export const QueryHeader = ({
  query,
  onQueryChange,
  setAzureLogsCheatSheetModalOpen,
  data,
  app,
  onRunQuery,
}: QueryTypeFieldProps) => {
  const isLoading = useMemo(() => data?.state === LoadingState.Loading, [data?.state]);

  const [showModeSwitchWarning, setShowModeSwitchWarning] = useState(false);
  const [pendingModeChange, setPendingModeChange] = useState<LogsEditorMode | null>(null);

  const EDITOR_MODES = [
    { label: t('components.query-header.editor-modes.label-builder', 'Builder'), value: LogsEditorMode.Builder },
    { label: t('components.query-header.editor-modes.label-kql', 'KQL'), value: LogsEditorMode.Raw },
  ];

  const currentMode = query.azureLogAnalytics?.mode;

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
    if (query.azureLogAnalytics && query.azureLogAnalytics.mode === undefined) {
      const updatedQuery = {
        ...query,
        azureLogAnalytics: {
          ...query.azureLogAnalytics,
          // Builder mode is default unless there is an existing Log Analytics query
          // that was not created with the builder
          mode:
            (query.azureLogAnalytics?.builderQuery === undefined && query.azureLogAnalytics?.query !== undefined) ||
            !config.featureToggles.azureMonitorLogsBuilderEditor
              ? LogsEditorMode.Raw
              : LogsEditorMode.Builder,
          dashboardTime: true,
        },
      };
      onQueryChange(updatedQuery);
    }
  }, [query, onQueryChange]);

  const onLogsModeChange = (newMode: LogsEditorMode) => {
    if (newMode === currentMode) {
      return;
    }

    const goingToBuilder = newMode === LogsEditorMode.Builder;
    const goingToRaw = newMode === LogsEditorMode.Raw;

    const hasRawKql = !!query.azureLogAnalytics?.query;
    const hasBuilderQuery = !!query.azureLogAnalytics?.builderQuery;

    if ((goingToBuilder && hasRawKql) || (goingToRaw && hasBuilderQuery)) {
      setPendingModeChange(newMode);
      setShowModeSwitchWarning(true);
    } else {
      applyModeChange(newMode);
    }
  };

  const applyModeChange = (mode: LogsEditorMode) => {
    const updatedQuery = {
      ...query,
      azureLogAnalytics: {
        ...query.azureLogAnalytics,
        mode,
        query: '',
        builderQuery: mode === LogsEditorMode.Raw ? undefined : query.azureLogAnalytics?.builderQuery,
        dashboardTime: mode === LogsEditorMode.Builder ? true : undefined,
      },
    };
    onQueryChange(updatedQuery);
  };

  return (
    <span data-testid={selectors.components.queryEditor.header.select}>
      <EditorHeader>
        <ConfirmModal
          isOpen={showModeSwitchWarning}
          title={t('components.query-header.title-switch-mode', 'Switch editor mode?')}
          body={
            pendingModeChange === LogsEditorMode.Builder
              ? t(
                  'components.query-header.body-switching-to-builder',
                  'Switching to Builder will discard your current KQL query and clear the KQL editor. Are you sure?'
                )
              : t(
                  'components.query-header.body-switching-to-kql',
                  'Switching to KQL will discard your current builder settings. Are you sure?'
                )
          }
          confirmText={t('components.query-header.confirmText-switch-to', 'Switch to {{newMode}}', {
            newMode: pendingModeChange === LogsEditorMode.Builder ? 'Builder' : 'KQL',
          })}
          onConfirm={() => {
            if (pendingModeChange) {
              applyModeChange(pendingModeChange);
            }
            setShowModeSwitchWarning(false);
            setPendingModeChange(null);
          }}
          onDismiss={() => {
            setShowModeSwitchWarning(false);
            setPendingModeChange(null);
          }}
        />

        <InlineSelect
          label={t('components.query-header.label-service', 'Service')}
          value={query.queryType === AzureQueryType.TraceExemplar ? AzureQueryType.AzureTraces : query.queryType}
          placeholder={t('components.query-header.placeholder-service', 'Service...')}
          allowCustomValue
          options={queryTypes}
          onChange={handleChange}
        />
        {query.queryType === AzureQueryType.LogAnalytics && query.azureLogAnalytics?.mode === LogsEditorMode.Raw && (
          <Button
            aria-label={t('components.query-header.aria-label-kick-start', 'Azure logs kick start your query button')}
            variant="secondary"
            size="sm"
            onClick={() => {
              setAzureLogsCheatSheetModalOpen((prev) => !prev);
              reportInteraction('grafana_azure_logs_query_patterns_opened', {
                version: 'v2',
                editorMode: query.azureLogAnalytics,
              });
            }}
          >
            <Trans i18nKey="components.query-header.button-kick-start-your-query">Kick start your query</Trans>
          </Button>
        )}
        <FlexItem grow={1} />
        {query.queryType === AzureQueryType.LogAnalytics && !!config.featureToggles.azureMonitorLogsBuilderEditor && (
          <RadioButtonGroup
            size="sm"
            options={EDITOR_MODES}
            value={query.azureLogAnalytics?.mode || LogsEditorMode.Builder}
            onChange={onLogsModeChange}
            data-testid="azure-query-header-logs-radio-button"
          />
        )}
        {query.azureLogAnalytics?.mode === LogsEditorMode.Builder &&
          !!config.featureToggles.azureMonitorLogsBuilderEditor &&
          app !== CoreApp.Explore && (
            <Button
              variant="primary"
              icon={isLoading ? 'spinner' : 'play'}
              size="sm"
              onClick={onRunQuery}
              data-testid={selectors.components.queryEditor.logsQueryEditor.runQuery.button}
            >
              <Trans i18nKey="components.query-header.button-run-query">Run query</Trans>
            </Button>
          )}
      </EditorHeader>
    </span>
  );
};
