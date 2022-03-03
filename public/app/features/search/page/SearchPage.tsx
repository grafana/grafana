import React, { useState } from 'react';
import { DataFrameView, GrafanaTheme2, NavModelItem } from '@grafana/data';
import { Input, useStyles2 } from '@grafana/ui';
import { useAsync } from 'react-use';
import { config } from '@grafana/runtime';
import AutoSizer from 'react-virtualized-auto-sizer';
import { css } from '@emotion/css';

import Page from 'app/core/components/Page/Page';
import { getDashboardData } from './data';
import { DashboardResult } from './types';
import { SearchPageDashboards } from './SearchPageDashboards';
import { SearchPagePanels } from './SearchPagePanels';
import { SearchPageStats } from './SearchPageStats';
import { SearchPageDashboardList } from './SearchPageDashboardList';
import { loadResults } from './state/actions';
import { useDispatch, useSelector } from 'react-redux';
import { StoreState } from 'app/types';

const node: NavModelItem = {
  id: 'search',
  text: 'Search',
  icon: 'dashboard',
  url: 'search',
};

export default function SearchPage() {
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);

  const dashboards = useSelector((state: StoreState) => state.searchPage.dashboards);
  const panels = useSelector((state: StoreState) => state.searchPage.panels);
  const panelTypes = useSelector((state: StoreState) => state.searchPage.panelTypes);
  const schemaVersions = useSelector((state: StoreState) => state.searchPage.schemaVersions);
  console.log({ dashboards, panels, panelTypes, schemaVersions }, 'here');

  const data = useAsync(getDashboardData, []);
  const [query, setQuery] = useState('');

  // if (dashboards.length < 1 || panels.length < 1) {
  //   console.log('load results', query);

  // }
  dispatch(loadResults(query));
  // useEffect(() => {
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);

  // useEffect(() => {
  //   dispatch(loadResults(query));
  // }, [query, dispatch]);
  // const filtered = useMemo(() => {
  //   if (!data.value?.dashboards.length || !query.length) {
  //     return data.value!; // everything
  //   }
  //   const dashboards = filterDataFrame(query, data.value.dashboards, 'Name', 'Description', 'Tags');
  //   const panels = filterDataFrame(query, data.value.panels, 'Name', 'Description', 'Type');
  //   return {
  //     dashboards,
  //     panels,
  //     panelTypes: buildStatsTable(panels.fields.find((f) => f.name === 'Type')),
  //     schemaVersions: buildStatsTable(dashboards.fields.find((f) => f.name === 'SchemaVersion')),
  //   };
  // }, [query, data]);

  if (!config.featureToggles.panelTitleSearch) {
    return <div className={styles.unsupported}>Unsupported</div>;
  }

  return (
    <Page navModel={{ node: node, main: node }}>
      <Page.Contents>
        <Input value={query} onChange={(e) => setQuery(e.currentTarget.value)} autoFocus spellCheck={false} />
        <br /> <br />
        {data.loading && <div>Loading....</div>}
        {!data.loading && (
          <div>
            <AutoSizer style={{ width: '100%', height: '1500px' }}>
              {({ width, height }) => {
                // Helper... could be MUCH more efficient, but this approach lets us treat
                // DataFrame results as well typed objects (the names must match the types)
                const dashboardResults =
                  dashboards.length > 0 ? new DataFrameView<DashboardResult>({ ...dashboards }) : undefined;
                return (
                  <div>
                    {dashboardResults && <SearchPageDashboardList dashboards={dashboardResults} />}

                    <br />

                    {dashboards && dashboards.length > 0 && (
                      <SearchPageDashboards dashboards={dashboards} width={width} />
                    )}

                    {panels && panels.length > 0 && <SearchPagePanels panels={panels} width={width} />}

                    <br />
                    {panelTypes && schemaVersions && (
                      <SearchPageStats panelTypes={panelTypes} schemaVersions={schemaVersions} width={width} />
                    )}
                  </div>
                );
              }}
            </AutoSizer>
          </div>
        )}
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  unsupported: css`
    padding: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 18px;
  `,
});
