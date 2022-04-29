import { css } from '@emotion/css';
import { useId } from '@react-aria/utils';
import pluralize from 'pluralize';
import React, { useCallback, useMemo } from 'react';
import { useAsync } from 'react-use';

import { DataQuery, GrafanaTheme2, PanelData, SelectableValue } from '@grafana/data';
import { InlineField, Select, useStyles2, VerticalGroup } from '@grafana/ui';
import config from 'app/core/config';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { PanelModel } from 'app/features/dashboard/state';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { filterPanelDataToQuery } from 'app/features/query/components/QueryEditorRow';

import { DashboardQueryRow } from './DashboardQueryRow';
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

export function DashboardQueryEditor({ panelData, queries, onChange, onRunQueries }: Props) {
  const { value: defaultDatasource } = useAsync(() => getDatasourceSrv().get());
  const { value: results, loading: loadingResults } = useAsync(async (): Promise<ResultInfo[]> => {
    const query = queries[0] as DashboardQuery;
    const dashboard = getDashboardSrv().getCurrent();
    const panel = dashboard?.getPanelById(query.panelId ?? -124134);

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
  }, [panelData, queries]);

  const query = queries[0] as DashboardQuery;

  const onPanelChanged = useCallback(
    (id: number) => {
      onChange([
        {
          ...query,
          panelId: id,
        } as DashboardQuery,
      ]);
      onRunQueries();
    },
    [query, onChange, onRunQueries]
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

  return (
    <>
      <InlineField label="Use results from panel" grow>
        <Select
          menuShouldPortal
          inputId={selectId}
          placeholder="Choose panel"
          isSearchable={true}
          options={panels}
          value={selected}
          onChange={(item) => onPanelChanged(item.value!)}
        />
      </InlineField>

      {results && !loadingResults && (
        <div className={styles.results}>
          {query.panelId && (
            <VerticalGroup spacing="sm">
              {results.map((target, i) => (
                <DashboardQueryRow editURL={editURL} target={target} key={`DashboardQueryRow-${i}`} />
              ))}
            </VerticalGroup>
          )}
        </div>
      )}
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
  };
}
