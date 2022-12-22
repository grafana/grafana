import { css } from '@emotion/css';
import { useId } from '@react-aria/utils';
import pluralize from 'pluralize';
import React, { useCallback, useMemo } from 'react';
import { useAsync } from 'react-use';

import { DataQuery, GrafanaTheme2, PanelData, SelectableValue, DataTopic } from '@grafana/data';
import { Field, Select, useStyles2, VerticalGroup, Spinner, Switch, RadioButtonGroup, Icon } from '@grafana/ui';
import config from 'app/core/config';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { PanelModel } from 'app/features/dashboard/state';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { filterPanelDataToQuery } from 'app/features/query/components/QueryEditorRow';

import { DashboardQuery, ResultInfo, SHARED_DASHBOARD_QUERY } from './types';

function getQueryDisplayText(query: DataQuery): string {
  return JSON.stringify(query);
}

interface Props {
  queries: DataQuery[];
  panelData: PanelData;
  onChange: (queries: DataQuery[]) => void;
  onRunQueries: () => void;
}

const topics = [
  { label: 'All data', value: false },
  { label: 'Annotations', value: true, description: 'Include annotations as regular data' },
];

export function DashboardQueryEditor({ panelData, queries, onChange, onRunQueries }: Props) {
  const { value: defaultDatasource } = useAsync(() => getDatasourceSrv().get());
  const query = queries[0] as DashboardQuery;

  const panel = useMemo(() => {
    const dashboard = getDashboardSrv().getCurrent();
    return dashboard?.getPanelById(query.panelId ?? -124134);
  }, [query.panelId]);

  const { value: results, loading: loadingResults } = useAsync(async (): Promise<ResultInfo[]> => {
    if (!panel) {
      return [];
    }
    const mainDS = await getDatasourceSrv().get(panel.datasource);
    return Promise.all(
      panel.targets.map(async (query) => {
        const ds = query.datasource ? await getDatasourceSrv().get(query.datasource) : mainDS;
        const fmt = ds.getQueryDisplayText || getQueryDisplayText;
        const queryData = filterPanelDataToQuery(panelData, query.refId) ?? panelData;
        return {
          refId: query.refId,
          query: fmt(query),
          img: ds.meta.info.logos.small,
          data: queryData.series,
          error: queryData.error,
        };
      })
    );
  }, [panelData, panel]);

  const onUpdateQuery = useCallback(
    (query: DashboardQuery) => {
      onChange([query]);
      onRunQueries();
    },
    [onChange, onRunQueries]
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
  const panels: Array<SelectableValue<number>> = useMemo(
    () =>
      dashboard?.panels
        .filter(
          (panel) =>
            config.panels[panel.type] &&
            panel.targets &&
            panel.id !== dashboard.panelInEdit?.id &&
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
  // Same as current URL, but different panelId
  const editURL = `d/${dashboard.uid}/${dashboard.title}?&editPanel=${query.panelId}`;
  const showTransforms = Boolean(query.withTransforms || panel?.transformations?.length);

  return (
    <>
      <Field label="Source" description="Use the same results as panel">
        <Select
          inputId={selectId}
          placeholder="Choose panel"
          isSearchable={true}
          options={panels}
          value={selected}
          onChange={(item) => onPanelChanged(item.value!)}
        />
      </Field>

      {loadingResults ? (
        <Spinner />
      ) : (
        <>
          {results && Boolean(results.length) && (
            <Field label="Queries">
              <VerticalGroup spacing="sm">
                {results.map((target, i) => (
                  <div className={styles.queryEditorRowHeader} key={`DashboardQueryRow-${i}`}>
                    <div>
                      <img src={target.img} alt="" width={16} />
                      <span className={styles.refId}>{target.refId}:</span>
                    </div>
                    <div>
                      <a href={editURL}>
                        {target.query}
                        &nbsp;
                        <Icon name="external-link-alt" />
                      </a>
                    </div>
                  </div>
                ))}
              </VerticalGroup>
            </Field>
          )}
        </>
      )}

      {showTransforms && (
        <Field label="Transform" description="Apply panel transformations from the source panel">
          <Switch value={Boolean(query.withTransforms)} onChange={onTransformToggle} />
        </Field>
      )}

      <Field label="Data">
        <RadioButtonGroup options={topics} value={query.topic === DataTopic.Annotations} onChange={onTopicChanged} />
      </Field>
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    results: css({
      padding: theme.spacing(2),
    }),
    noQueriesText: css({
      padding: theme.spacing(1.25),
    }),
    refId: css({
      padding: theme.spacing(1.25),
    }),
    queryEditorRowHeader: css`
      label: queryEditorRowHeader;
      display: flex;
      padding: 4px 8px;
      flex-flow: row wrap;
      background: ${theme.colors.background.secondary};
      align-items: center;
    `,
  };
}
