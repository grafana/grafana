import { LoadingState, NavModelItem } from '@grafana/data';
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
    if (!data.value?.dashboards) {
      return { length: 0, fields: [] };
    }
    return filterDataFrame(query, data.value.dashboards, 'Name', 'Description', 'Tags');
  }, [query, data]);

  if (!config.featureToggles.panelTitleSearch) {
    return <div>Unsupported</div>;
  }

  return (
    <Page navModel={{ node: node, main: node }}>
      <Page.Contents>
        <Input value={query} onChange={(e) => setQuery(e.currentTarget.value)} autoFocus spellCheck={false} />

        {data.loading && <div>Loading....</div>}
        {!data.loading && (
          <div>
            <AutoSizer style={{ width: '100%', height: '600px' }}>
              {({ width, height }) => {
                return (
                  <div>
                    <PanelRenderer
                      pluginId="table"
                      title="search"
                      data={{ series: [filtered], state: LoadingState.Done } as any}
                      options={{}}
                      width={width - 2} // ?????? otherwise it keeps growing!!!
                      height={height}
                      fieldConfig={{ defaults: {}, overrides: [] }}
                      timeZone="browser"
                    />
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
