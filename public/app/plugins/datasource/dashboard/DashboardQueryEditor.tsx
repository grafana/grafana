import { css } from '@emotion/css';
import { useId } from '@react-aria/utils';
import pluralize from 'pluralize';
import { useCallback, useMemo } from 'react';
import { useAsync } from 'react-use';

import { DataQuery, GrafanaTheme2, SelectableValue, DataTopic, QueryEditorProps } from '@grafana/data';
import { OperationsEditorRow } from '@grafana/experimental';
import { Field, Select, useStyles2, Spinner, RadioButtonGroup, Stack, InlineSwitch } from '@grafana/ui';
import config from 'app/core/config';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { filterPanelDataToQuery } from 'app/features/query/components/QueryEditorRow';

import { SHARED_DASHBOARD_QUERY } from './constants';
import { DashboardDatasource } from './datasource';
import { DashboardQuery, ResultInfo } from './types';

function getQueryDisplayText(query: DataQuery): string {
  return JSON.stringify(query);
}

function isPanelInEdit(panelId: number, panelInEditId?: number) {
  let idToCompareWith = panelInEditId;

  if (window.__grafanaSceneContext && window.__grafanaSceneContext instanceof DashboardScene) {
    idToCompareWith = window.__grafanaSceneContext.state.editPanel?.getPanelId();
  }

  return panelId === idToCompareWith;
}

interface Props extends QueryEditorProps<DashboardDatasource, DashboardQuery> {}

const topics = [
  { label: 'All data', value: false },
  { label: 'Annotations', value: true, description: 'Include annotations as regular data' },
];

export function DashboardQueryEditor({ data, query, onChange, onRunQuery }: Props) {
  const { value: defaultDatasource } = useAsync(() => getDatasourceSrv().get());

  const panel = useMemo(() => {
    const dashboard = getDashboardSrv().getCurrent();
    return dashboard?.getPanelById(query.panelId ?? -124134);
  }, [query.panelId]);

  const { value: results, loading: loadingResults } = useAsync(async (): Promise<ResultInfo[]> => {
    if (!panel || !data) {
      return [];
    }
    const mainDS = await getDatasourceSrv().get(panel.datasource);
    return Promise.all(
      panel.targets.map(async (query) => {
        const ds = query.datasource ? await getDatasourceSrv().get(query.datasource) : mainDS;
        const fmt = ds.getQueryDisplayText || getQueryDisplayText;
        const queryData = filterPanelDataToQuery(data, query.refId) ?? data;
        return {
          refId: query.refId,
          query: fmt(query),
          name: ds.name,
          img: ds.meta.info.logos.small,
          data: queryData.series,
          error: queryData.error,
        };
      })
    );
  }, [data, panel]);

  const onUpdateQuery = useCallback(
    (query: DashboardQuery) => {
      onChange(query);
      onRunQuery();
    },
    [onChange, onRunQuery]
  );

  const onPanelChanged = useCallback(
    (id: number) => {
      onUpdateQuery({
        ...query,
        panelId: id,
      });
    },
    [query, onUpdateQuery]
  );

  const onTransformToggle = useCallback(() => {
    onUpdateQuery({
      ...query,
      withTransforms: !query.withTransforms,
    });
  }, [query, onUpdateQuery]);

  const onTopicChanged = useCallback(
    (t: boolean) => {
      onUpdateQuery({
        ...query,
        topic: t ? DataTopic.Annotations : undefined,
      });
    },
    [query, onUpdateQuery]
  );

  const getPanelDescription = useCallback(
    (panel: PanelModel): string => {
      const datasource = panel.datasource ?? defaultDatasource;
      const dsname = getDatasourceSrv().getInstanceSettings(datasource)?.name;
      const queryCount = panel.targets.length;
      return `${queryCount} ${pluralize('query', queryCount)} to ${dsname}`;
    },
    [defaultDatasource]
  );

  const dashboard = getDashboardSrv().getCurrent();
  const showTransforms = Boolean(query.withTransforms || panel?.transformations?.length);
  const panels: Array<SelectableValue<number>> = useMemo(
    () =>
      dashboard?.panels
        .filter(
          (panel) =>
            config.panels[panel.type] &&
            panel.targets &&
            !isPanelInEdit(panel.id, dashboard.panelInEdit?.id) &&
            panel.datasource?.uid !== SHARED_DASHBOARD_QUERY
        )
        .map((panel) => ({
          value: panel.id,
          label: panel.title ?? 'Panel ' + panel.id,
          description: getPanelDescription(panel),
          imgUrl: config.panels[panel.type].info.logos.small,
        })) ?? [],
    [dashboard, getPanelDescription]
  );

  const styles = useStyles2(getStyles);
  const selectId = useId();

  if (!dashboard) {
    return null;
  }

  if (panels.length < 1) {
    return (
      <p className={styles.noQueriesText}>
        This dashboard does not have any other panels. Add queries to other panels and try again.
      </p>
    );
  }

  const selected = panels.find((panel) => panel.value === query.panelId);

  return (
    <OperationsEditorRow>
      <Stack direction="column">
        <Stack gap={3}>
          <Field label="Source panel" description="Use query results from another panel">
            <Select
              inputId={selectId}
              placeholder="Choose panel"
              isSearchable={true}
              options={panels}
              value={selected}
              onChange={(item) => onPanelChanged(item.value!)}
            />
          </Field>

          <Field label="Data" description="Use data or annotations from the panel">
            <RadioButtonGroup
              options={topics}
              value={query.topic === DataTopic.Annotations}
              onChange={onTopicChanged}
            />
          </Field>

          {showTransforms && (
            <Field label="Transform" description="Apply transformations from the source panel">
              <InlineSwitch value={Boolean(query.withTransforms)} onChange={onTransformToggle} />
            </Field>
          )}
        </Stack>

        {loadingResults ? (
          <Spinner />
        ) : (
          <>
            {results && Boolean(results.length) && (
              <Field label="Queries from panel">
                <Stack direction="column">
                  {results.map((target, i) => (
                    <Stack key={i} alignItems="center" gap={1}>
                      <div>{target.refId}</div>
                      <img src={target.img} alt={target.name} title={target.name} width={16} />
                      <div>{target.query}</div>
                    </Stack>
                  ))}
                </Stack>
              </Field>
            )}
          </>
        )}
      </Stack>
    </OperationsEditorRow>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    noQueriesText: css({
      padding: theme.spacing(1.25),
    }),
  };
}
