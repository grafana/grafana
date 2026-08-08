import { css } from '@emotion/css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAsync } from 'react-use';

import {
  CoreApp,
  DataSourcePluginContextProvider,
  rangeUtil,
  type DataQuery,
  type DataSourceInstanceSettings,
  type GrafanaTheme2,
  type PanelData,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { DataSourcePicker, getDataSourceSrv } from '@grafana/runtime';
import { type PanelKind } from '@grafana/schema/apis/notebook/v2beta1';
import { Alert, Button, IconButton, Select, Spinner, Stack, useStyles2 } from '@grafana/ui';

// The established CoreApp value for embedded, standalone query editors (same choice as
// the saved-queries inline editor): datasource editors gate host-specific chrome like
// "Query with Assistant" to Explore/Dashboard/PanelEditor.
const EDITOR_APP = CoreApp.Correlations;

interface Props {
  panel: PanelKind;
  /** The block's effective time range, passed to the editor for hints/preview. */
  timeFrom: string;
  timeTo: string;
  /** Latest query results of the panel, for editors that render field pickers etc. */
  getData?: () => PanelData | undefined;
  /** Commits the edited query (and datasource, when changed) — the panel re-runs. */
  onApply: (refId: string, query: DataQuery, datasource: { uid: string; type: string }) => void;
  onClose: () => void;
}

/**
 * Inline query editing for a notebook panel block: renders the datasource's own
 * query editor (the same component Explore embeds). Edits are local drafts until
 * "Run query" (or Ctrl/Cmd+Enter) commits them to the notebook, which re-runs the
 * panel — so keystrokes never thrash queries, and every run lands in autosave.
 */
export function PanelQueryEditor({ panel, timeFrom, timeTo, getData, onApply, onClose }: Props) {
  const styles = useStyles2(getStyles);
  const queries = panel.spec.data.spec.queries;
  const [selectedRefId, setSelectedRefId] = useState(queries[0]?.spec.refId ?? 'A');
  const selected = queries.find((query) => query.spec.refId === selectedRefId) ?? queries[0];

  // The panel's stored datasource — overridable via the picker below.
  const [datasource, setDatasource] = useState<{ uid: string; type: string }>(() => ({
    uid: selected?.spec.query.datasource?.name ?? '',
    type: selected?.spec.query.group ?? '',
  }));

  const baseline = useMemo<DataQuery>(
    () => ({
      refId: selected?.spec.refId ?? 'A',
      ...selected?.spec.query.spec,
      datasource: { uid: datasource.uid, type: datasource.type },
    }),
    [selected, datasource]
  );

  const [draft, setDraft] = useState<DataQuery>(baseline);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // Reset the draft only when the underlying stored query *content* changes (apply,
  // remote update, switching refId) — collaboration churn that replaces spec object
  // identities without changing content must never clobber in-progress typing.
  const baselineJson = JSON.stringify(baseline);
  const lastBaselineJson = useRef(baselineJson);
  useEffect(() => {
    if (lastBaselineJson.current !== baselineJson) {
      lastBaselineJson.current = baselineJson;
      const next: DataQuery = JSON.parse(baselineJson);
      setDraft(next);
      draftRef.current = next;
    }
  }, [baselineJson]);

  // Primitive deps: spec object identity churns with every collaboration sync, the
  // uid/type strings do not — the datasource must not reload (and the editor must
  // not unmount) unless the actual datasource changed.
  const { value: datasourceApi, loading: datasourceLoading } = useAsync(
    () => getDataSourceSrv().get({ uid: datasource.uid, type: datasource.type }),
    [datasource.uid, datasource.type]
  );

  const editorRange = useMemo(() => rangeUtil.convertRawToRange({ from: timeFrom, to: timeTo }), [timeFrom, timeTo]);

  const apply = () => {
    onApply(selectedRefId, draftRef.current, datasource);
  };

  const onChangeDatasource = (ds: DataSourceInstanceSettings) => {
    setDatasource({ uid: ds.uid, type: ds.type });
    // Query models are datasource-specific; a different type starts a fresh query.
    if (ds.type !== datasource.type) {
      const fresh: DataQuery = { refId: selectedRefId, datasource: { uid: ds.uid, type: ds.type } };
      setDraft(fresh);
      draftRef.current = fresh;
    }
  };

  const QueryEditor = datasourceApi?.components?.QueryEditor;
  const instanceSettings = datasource.uid ? getDataSourceSrv().getInstanceSettings(datasource.uid) : undefined;

  const refIdOptions = queries.map((query) => ({ label: query.spec.refId, value: query.spec.refId }));

  return (
    <div className={styles.container} data-testid="notebook-panel-query-editor">
      <div className={styles.header}>
        <Stack direction="row" gap={1} alignItems="center">
          <div className={styles.dsPicker}>
            <DataSourcePicker current={datasource.uid || null} onChange={onChangeDatasource} />
          </div>
          {queries.length > 1 && (
            <Select
              width={10}
              options={refIdOptions}
              value={selectedRefId}
              onChange={(option) => option.value && setSelectedRefId(option.value)}
              aria-label={t('notebooks.query-editor.query-picker', 'Query to edit')}
            />
          )}
        </Stack>
        <Stack direction="row" gap={1} alignItems="center">
          <Button
            size="sm"
            variant="primary"
            icon="play"
            onClick={apply}
            disabled={!datasourceApi}
            tooltip={t('notebooks.query-editor.run-tooltip', 'Ctrl/Cmd + Enter to run')}
          >
            <Trans i18nKey="notebooks.query-editor.run">Run query</Trans>
          </Button>
          <IconButton
            name="times"
            tooltip={t('notebooks.query-editor.close', 'Close query editor')}
            onClick={onClose}
          />
        </Stack>
      </div>

      {/* Only the very first datasource load shows a spinner. Background reloads keep
          the previous editor mounted, preserving focus and typing state. */}
      {!datasourceApi && datasourceLoading && <Spinner />}

      {QueryEditor && instanceSettings && datasourceApi && (
        // Ctrl/Cmd+Enter runs from anywhere in the editor — Explore muscle memory.
        // Code-mode editors (Monaco) handle it themselves via onRunQuery.
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              apply();
            }
          }}
        >
          <DataSourcePluginContextProvider instanceSettings={instanceSettings}>
            <QueryEditor
              app={EDITOR_APP}
              datasource={datasourceApi}
              query={draft}
              onChange={(updated: DataQuery) => {
                // Editors may call onChange then onRunQuery synchronously — keep the
                // ref current so the run commits the just-typed version.
                draftRef.current = updated;
                setDraft(updated);
              }}
              onRunQuery={apply}
              data={getData?.()}
              range={editorRange}
            />
          </DataSourcePluginContextProvider>
        </div>
      )}

      {!datasourceLoading && datasourceApi && !QueryEditor && (
        <Alert
          severity="warning"
          title={t(
            'notebooks.query-editor.no-editor',
            'This data source does not provide a query editor that can be embedded here.'
          )}
        />
      )}

      {!datasourceLoading && !datasourceApi && (
        <Alert
          severity="warning"
          title={t('notebooks.query-editor.no-datasource', 'The data source for this panel could not be loaded.')}
        />
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    padding: theme.spacing(1),
    marginBottom: theme.spacing(1),
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  }),
  dsPicker: css({
    minWidth: 200,
  }),
});
