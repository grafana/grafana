import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { Input, useStyles2 } from '@grafana/ui';
import { config } from '@grafana/runtime';
import AutoSizer from 'react-virtualized-auto-sizer';
import { css } from '@emotion/css';

import Page from 'app/core/components/Page/Page';
import { SearchPageDashboards } from './SearchPageDashboards';
import { SearchPageDashboardList } from './SearchPageDashboardList';
import { loadResults } from './state/actions';
import { StoreState } from 'app/types';
import { SearchPageStats } from './SearchPageStats';
import { buildStatsTable } from './data';

const node: NavModelItem = {
  id: 'search',
  text: 'Search',
  icon: 'dashboard',
  url: 'search',
};

export default function SearchPage() {
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);

  const dashboards = useSelector((state: StoreState) => state.searchPage.data.dashboards);
  const panels = useSelector((state: StoreState) => state.searchPage.data.panels);

  const [query, setQuery] = useState('');

  const loadDashboardResults = useCallback(async () => {
    await dispatch(loadResults(query));
  }, [query, dispatch]);

  useEffect(() => {
    loadDashboardResults();
  }, [query, loadDashboardResults]);

  if (!config.featureToggles.panelTitleSearch) {
    return <div className={styles.unsupported}>Unsupported</div>;
  }

  return (
    <Page navModel={{ node: node, main: node }}>
      <Page.Contents>
        <Input value={query} onChange={(e) => setQuery(e.currentTarget.value)} autoFocus spellCheck={false} />
        <br /> <br />
        {!dashboards && <div>Loading....</div>}
        {dashboards && (
          <div>
            <AutoSizer style={{ width: '100%', height: '1000px' }}>
              {({ width }) => {
                return (
                  <div>
                    {dashboards && <SearchPageDashboardList dashboards={dashboards} />}
                    <br />
                    {dashboards.dataFrame && dashboards.dataFrame.length > 0 && (
                      <SearchPageDashboards dashboards={dashboards.dataFrame} width={width} />
                    )}

                    {panels && (
                      <SearchPageStats
                        panelTypes={buildStatsTable(panels.fields.find((f) => f.name === 'Type'))}
                        width={width}
                      />
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
