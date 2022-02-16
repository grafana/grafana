import { LoadingState, NavModelItem, DataFrame } from '@grafana/data';
import { Input } from '@grafana/ui';
import React, { useMemo, useState } from 'react';
import Page from 'app/core/components/Page/Page';
import { useAsync } from 'react-use';
import { filterDataFrame, getDashboardData } from './data';
import { config, PanelRenderer } from '@grafana/runtime';
import AutoSizer from 'react-virtualized-auto-sizer';

export default function SearchPage() {
  const node: NavModelItem = {
    id: 'search',
    text: 'Search',
    icon: 'dashboard',
    url: 'search',
  };

  const data = useAsync(getDashboardData, []);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    if (!data.value?.dashboards.length) {
      const empty: DataFrame = { length: 0, fields: [] };
      return {
        dashboards: empty,
        panels: empty,
      };
    }
    return {
      dashboards: filterDataFrame(query, data.value.dashboards, 'Name', 'Description', 'Tags'),
      panels: filterDataFrame(query, data.value.panels, 'Name', 'Description', 'Type'),
    };
  }, [query, data]);

  if (!config.featureToggles.panelTitleSearch) {
    return <div>Unsupported</div>;
  }

  return (
    <Page navModel={{ node: node, main: node }}>
      <Page.Contents>
        <Input value={query} onChange={(e) => setQuery(e.currentTarget.value)} autoFocus spellCheck={false} />
        <br /> <br />
        {data.loading && <div>Loading....</div>}
        {!data.loading && (
          <div>
            <AutoSizer style={{ width: '100%', height: '800px' }}>
              {({ width, height }) => {
                return (
                  <div>
                    {filtered.dashboards.length > 0 && (
                      <>
                        <h1>Dashboards ({filtered.dashboards.length})</h1>
                        <PanelRenderer
                          pluginId="table"
                          title="Dashboards"
                          data={{ series: [filtered.dashboards], state: LoadingState.Done } as any}
                          options={{}}
                          width={width - 2} // ?????? otherwise it keeps growing!!!
                          height={300}
                          fieldConfig={{ defaults: {}, overrides: [] }}
                          timeZone="browser"
                        />
                        <br />
                      </>
                    )}

                    {filtered.panels.length > 0 && (
                      <>
                        <h1>Panels ({filtered.panels.length})</h1>
                        <PanelRenderer
                          pluginId="table"
                          title="Panels"
                          data={{ series: [filtered.panels], state: LoadingState.Done } as any}
                          options={{}}
                          width={width - 2} // ?????? otherwise it keeps growing!!!
                          height={300}
                          fieldConfig={{ defaults: {}, overrides: [] }}
                          timeZone="browser"
                        />
                      </>
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
