// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/PromQueryEditorSelector.tsx
import { isEqual } from 'lodash';
import { memo, SyntheticEvent, useCallback, useEffect, useState } from 'react';

import { CoreApp, LoadingState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { EditorHeader, EditorRows, FlexItem } from '@grafana/plugin-ui';
import { reportInteraction } from '@grafana/runtime';
import { Button, ConfirmModal, Space } from '@grafana/ui';

import { PromQueryEditorProps } from '../../components/types';
import { PromQuery } from '../../types';
import { QueryPatternsModal } from '../QueryPatternsModal';
import { promQueryEditorExplainKey, useFlag } from '../hooks/useFlag';
import { buildVisualQueryFromString } from '../parsing';
import { QueryEditorModeToggle } from '../shared/QueryEditorModeToggle';
import { QueryHeaderSwitch } from '../shared/QueryHeaderSwitch';
import { QueryEditorMode } from '../shared/types';
import { changeEditorMode, getQueryWithDefaults } from '../state';

import { PromQueryBuilderContainer } from './PromQueryBuilderContainer';
import { PromQueryBuilderOptions } from './PromQueryBuilderOptions';
import { PromQueryCodeEditor } from './PromQueryCodeEditor';
import { PromQueryCodeEditorAutocompleteInfo } from './PromQueryCodeEditorAutocompleteInfo';

type Props = PromQueryEditorProps;

export const PromQueryEditorSelector = memo<Props>((props) => {
  const {
    onChange,
    onRunQuery,
    data,
    app,
    onAddQuery,
    datasource: { defaultEditor },
    queries,
  } = props;

  const [parseModalOpen, setParseModalOpen] = useState(false);
  const [queryPatternsModalOpen, setQueryPatternsModalOpen] = useState(false);
  const [dataIsStale, setDataIsStale] = useState(false);
  const { flag: explain, setFlag: setExplain } = useFlag(promQueryEditorExplainKey);

  const query = getQueryWithDefaults(props.query, app, defaultEditor);
  // This should be filled in from the defaults by now.
  const editorMode = query.editorMode!;

  const onEditorModeChange = useCallback(
    (newMetricEditorMode: QueryEditorMode) => {
      reportInteraction('user_grafana_prometheus_editor_mode_clicked', {
        newEditor: newMetricEditorMode,
        previousEditor: query.editorMode ?? '',
        newQuery: !query.expr,
        app: app ?? '',
      });

      if (newMetricEditorMode === QueryEditorMode.Builder) {
        const result = buildVisualQueryFromString(query.expr || '');
        // If there are errors, give user a chance to decide if they want to go to builder as that can lose some data.
        if (result.errors.length) {
          setParseModalOpen(true);
          return;
        }
      }
      changeEditorMode(query, newMetricEditorMode, onChange);
    },
    [onChange, query, app]
  );

  useEffect(() => {
    setDataIsStale(false);
  }, [data]);

  const onChangeInternal = (query: PromQuery) => {
    if (!isEqual(query, props.query)) {
      setDataIsStale(true);
    }
    onChange(query);
  };

  const onShowExplainChange = (e: SyntheticEvent<HTMLInputElement>) => {
    setExplain(e.currentTarget.checked);
  };

  const handleOpenQueryPatternsModal = useCallback(() => {
    reportInteraction('grafana_prometheus_open_kickstart_clicked', {
      app: app ?? '',
    });
    setQueryPatternsModalOpen(true);
  }, [app]);

  return (
    <>
      <ConfirmModal
        isOpen={parseModalOpen}
        title={t(
          'grafana-prometheus.querybuilder.prom-query-editor-selector.title-parsing-error-switch-builder',
          'Parsing error: Switch to the builder mode?'
        )}
        body={t(
          'grafana-prometheus.querybuilder.prom-query-editor-selector.body-syntax-error',
          'There is a syntax error, or the query structure cannot be visualized when switching to the builder mode. Parts of the query may be lost.'
        )}
        confirmText={t('grafana-prometheus.querybuilder.prom-query-editor-selector.confirmText-continue', 'Continue')}
        onConfirm={() => {
          changeEditorMode(query, QueryEditorMode.Builder, onChange);
          setParseModalOpen(false);
        }}
        onDismiss={() => setParseModalOpen(false)}
      />
      <QueryPatternsModal
        isOpen={queryPatternsModalOpen}
        onClose={() => setQueryPatternsModalOpen(false)}
        query={query}
        queries={queries}
        app={app}
        onChange={onChange}
        onAddQuery={onAddQuery}
      />
      <EditorHeader>
        <Button
          data-testid={selectors.components.QueryBuilder.queryPatterns}
          variant="secondary"
          size="sm"
          onClick={handleOpenQueryPatternsModal}
        >
          <Trans i18nKey="grafana-prometheus.querybuilder.prom-query-editor-selector.kick-start-your-query">
            Kick start your query
          </Trans>
        </Button>
        <div data-testid={selectors.components.DataSource.Prometheus.queryEditor.explain}>
          <QueryHeaderSwitch
            label={t('grafana-prometheus.querybuilder.prom-query-editor-selector.label-explain', 'Explain')}
            value={explain}
            onChange={onShowExplainChange}
          />
        </div>
        <FlexItem grow={1} />
        {app !== CoreApp.Explore && app !== CoreApp.Correlations && (
          <Button
            variant={dataIsStale ? 'primary' : 'secondary'}
            size="sm"
            onClick={onRunQuery}
            icon={data?.state === LoadingState.Loading ? 'spinner' : undefined}
            disabled={data?.state === LoadingState.Loading}
          >
            <Trans i18nKey="grafana-prometheus.querybuilder.prom-query-editor-selector.run-queries">Run queries</Trans>
          </Button>
        )}
        <PromQueryCodeEditorAutocompleteInfo datasourceUid={props.datasource.uid} editorMode={editorMode} />
        <div data-testid={selectors.components.DataSource.Prometheus.queryEditor.editorToggle}>
          <QueryEditorModeToggle mode={editorMode} onChange={onEditorModeChange} />
        </div>
      </EditorHeader>
      <Space v={0.5} />
      <EditorRows>
        {editorMode === QueryEditorMode.Code && (
          <PromQueryCodeEditor {...props} query={query} showExplain={explain} onChange={onChangeInternal} />
        )}
        {editorMode === QueryEditorMode.Builder && (
          <PromQueryBuilderContainer
            query={query}
            datasource={props.datasource}
            onChange={onChangeInternal}
            onRunQuery={props.onRunQuery}
            data={data}
            showExplain={explain}
          />
        )}
        <PromQueryBuilderOptions query={query} app={props.app} onChange={onChange} onRunQuery={onRunQuery} />
      </EditorRows>
    </>
  );
});

PromQueryEditorSelector.displayName = 'PromQueryEditorSelector';
