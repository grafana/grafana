// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/PromQueryEditorSelector.tsx
import { isEqual, map } from 'lodash';
import { memo, SyntheticEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { CoreApp, LoadingState, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { EditorHeader, EditorRows, FlexItem } from '@grafana/experimental';
import { reportInteraction } from '@grafana/runtime';
import { Button, ConfirmModal, Space } from '@grafana/ui';

import { PromQueryEditorProps } from '../../components/types';
import { PromQueryFormat } from '../../dataquery';
import { PromQuery } from '../../types';
import { QueryPatternsModal } from '../QueryPatternsModal';
import { promQueryEditorExplainKey, useFlag } from '../hooks/useFlag';
import { buildVisualQueryFromString, isValidPromQLMinusGrafanaGlobalVariables } from '../parsing';
import { QueryEditorModeToggle } from '../shared/QueryEditorModeToggle';
import { QueryHeaderSwitch } from '../shared/QueryHeaderSwitch';
import { QueryEditorMode } from '../shared/types';
import { changeEditorMode, getQueryWithDefaults } from '../state';

import { PromQueryBuilderContainer } from './PromQueryBuilderContainer';
import { PromQueryBuilderOptions } from './PromQueryBuilderOptions';
import { PromQueryCodeEditor } from './PromQueryCodeEditor';
import { PromQueryCodeEditorAutocompleteInfo } from './PromQueryCodeEditorAutocompleteInfo';

export const FORMAT_OPTIONS: Array<SelectableValue<PromQueryFormat>> = [
  { label: 'Time series', value: 'time_series' },
  { label: 'Table', value: 'table' },
  { label: 'Heatmap', value: 'heatmap' },
];

export const INTERVAL_FACTOR_OPTIONS: Array<SelectableValue<number>> = map([1, 2, 3, 4, 5, 10], (value: number) => ({
  value,
  label: '1/' + value,
}));

const eventSourceOodleGrafana = 'oodle';
const eventTypeUpdateThresholds = 'updateThresholds';

type Props = PromQueryEditorProps;

class DelayedTriggerState {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private delay: number;
  private action: () => void;
  private state = false; // Indicates if the trigger is active

  constructor(action: () => void, delay = 3000) {
    this.action = action;
    this.delay = delay;
  }

  start() {
    this.reset();
    this.state = true;
    this.timer = setTimeout(() => {
      this.state = false;
      this.action();
    }, this.delay);
  }

  reset() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.state = false;
  }

  isActive() {
    return this.state;
  }
}

export const PromQueryEditorSelector = memo<Props>((props) => {
  const {
    onChange,
    onRunQuery,
    data,
    app,
    onAddQuery,
    datasource: { defaultEditor },
    queries,
    queryBuilderOnly,
  } = props;

  const [parseModalOpen, setParseModalOpen] = useState(false);
  const [queryPatternsModalOpen, setQueryPatternsModalOpen] = useState(false);
  const [dataIsStale, setDataIsStale] = useState(false);
  const delayTrigger = useMemo(() => new DelayedTriggerState(onRunQuery), [onRunQuery]);
  const { flag: explain, setFlag: setExplain } = useFlag(promQueryEditorExplainKey);
  const [hideBuilderMode, setHideBuilderMode] = useState<boolean>(false);

  const query = getQueryWithDefaults(props.query, app, defaultEditor);
  // This should be filled in from the defaults by now.. Pull in the defaults once
  // Track mode locally so it never gets yanked out from under us
  const [editorMode, setEditorMode] = useState<QueryEditorMode>(query.editorMode!);
  useEffect(() => {
    const handleEvent = (event: { data: any; origin: string }) => {
      const { type, payload } = event.data;
      if (type !== 'message') {
        return
      }
      if (payload?.source !== eventSourceOodleGrafana) {
        return
      }
      if (payload?.eventType !== eventTypeUpdateThresholds) {
        return
      }

      onChange({
        ...query,
        expr: payload?.query,
      });
      onRunQuery();
    };

    window.addEventListener('message', handleEvent, false);

    return () => {
      window.removeEventListener('message', handleEvent);
    };
  }, []);

  useEffect(() => {
    const result = buildVisualQueryFromString(query.expr || '');
    // If there are errors, give user a chance to decide if they want to go to builder as that can lose some data.
    if (result.errors.length) {
      setHideBuilderMode(true);
    } else {
      setHideBuilderMode(false);
    }
  }, [query.expr]);

  console.log(hideBuilderMode);
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
      setEditorMode(newMetricEditorMode);

      if (queryBuilderOnly) {
        // Trigger onRunQuery to change URL to reflect the new editor mode.
        onRunQuery();
      }
    },
    [onChange, query, app]
  );

  useEffect(() => {
    setDataIsStale(false);
  }, [data]);

  useEffect(() => {
    window.parent.postMessage({
      type: 'message',
      payload: {
        source: 'oodle-grafana',
        eventType: 'dataIsStale',
        value: {
          dataIsStale,
        }
      },
    }, '*');
  }, [dataIsStale])

  const onChangeInternal = (query: PromQuery) => {
    if (!isEqual(query, props.query)) {
      setDataIsStale(true);

      if (isValidPromQLMinusGrafanaGlobalVariables(query.expr)) {
        if (editorMode === QueryEditorMode.Builder) {
          onRunQuery();
        } else {
          // For code editor add a delay before running query rather than do it for
          // every character.
          delayTrigger.start();
        }
      } else {
        delayTrigger.reset();
      }
    }
    onChange(query);
  };

  const onShowExplainChange = (e: SyntheticEvent<HTMLInputElement>) => {
    setExplain(e.currentTarget.checked);
  };

  const searchParams = new URLSearchParams(window.location.search);
  const hideQueryEditor = searchParams.has('hideQueryBuilder');
  if (hideQueryEditor) {
    return null;
  }

  return (
    <>
      <ConfirmModal
        isOpen={parseModalOpen}
        title="Parsing error: Switch to the builder mode?"
        body="There is a syntax error, or the query structure cannot be visualized when switching to the builder mode. Parts of the query may be lost. "
        confirmText="Continue"
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
          onClick={() => setQueryPatternsModalOpen((prevValue) => !prevValue)}
        >
          Kick start your query
        </Button>
        <div data-testid={selectors.components.DataSource.Prometheus.queryEditor.explain}>
          <QueryHeaderSwitch label="Explain" value={explain} onChange={onShowExplainChange} />
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
            Run queries
          </Button>
        )}
        <PromQueryCodeEditorAutocompleteInfo datasourceUid={props.datasource.uid} editorMode={editorMode} />
        <div data-testid={selectors.components.DataSource.Prometheus.queryEditor.editorToggle}>
          <QueryEditorModeToggle mode={editorMode} onChange={onEditorModeChange} hideBuilder={hideBuilderMode} />
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
        {!queryBuilderOnly && <PromQueryBuilderOptions query={query} app={props.app} onChange={onChange} onRunQuery={onRunQuery} />}
      </EditorRows>
    </>
  );
});

PromQueryEditorSelector.displayName = 'PromQueryEditorSelector';
