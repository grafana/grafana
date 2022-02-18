import { DataFrameView, LoadingState, NavModelItem } from '@grafana/data';
import { Input } from '@grafana/ui';
import React, { useMemo, useState } from 'react';
import Page from 'app/core/components/Page/Page';
import { useAsync } from 'react-use';
import { buildStatsTable, filterDataFrame, getDashboardData } from './data';
import { config, PanelRenderer } from '@grafana/runtime';
import AutoSizer from 'react-virtualized-auto-sizer';
import { DashboardResult } from './types';

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
    if (!data.value?.dashboards.length || !query.length) {
      return data.value!; // everything
    }
    const dashboards = filterDataFrame(query, data.value.dashboards, 'Name', 'Description', 'Tags');
    const panels = filterDataFrame(query, data.value.panels, 'Name', 'Description', 'Type');
    return {
      dashboards,
      panels,
      panelTypes: buildStatsTable(panels.fields.find((f) => f.name === 'Type')),
      schemaVersions: buildStatsTable(dashboards.fields.find((f) => f.name === 'SchemaVersion')),
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
            <AutoSizer style={{ width: '100%', height: '1500px' }}>
              {({ width, height }) => {
                // Helper... could be MUCH more efficient, but this approach lets us treat
                // DataFrame results as well typed objects (the names must match the types)
                const dashboards = new DataFrameView<DashboardResult>(filtered.dashboards);
                return (
                  <div>
                    <div style={{ maxHeight: '300px', overflow: 'scroll' }}>
                      {dashboards.map((dash) => (
                        <div key={dash.UID}>
                          <a href={`/d/${dash.UID}/`}>{dash.Name}</a>
                        </div>
                      ))}
                    </div>

                    <hr />
                    <hr />

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

                    <br />
                    <h1>Stats</h1>
                    <table style={{ width: '100%' }}>
                      <tr>
                        <td>
                          <PanelRenderer
                            pluginId="table"
                            title="Panels"
                            data={{ series: [filtered.panelTypes], state: LoadingState.Done } as any}
                            options={{}}
                            width={width / 2 - 50} // ?????? otherwise it keeps growing!!!
                            height={200}
                            fieldConfig={{ defaults: {}, overrides: [] }}
                            timeZone="browser"
                          />
                        </td>
                        <td>
                          <PanelRenderer
                            pluginId="table"
                            title="Panels"
                            data={{ series: [filtered.schemaVersions], state: LoadingState.Done } as any}
                            options={{}}
                            width={width / 2 - 50} // ?????? otherwise it keeps growing!!!
                            height={200}
                            fieldConfig={{ defaults: {}, overrides: [] }}
                            timeZone="browser"
                          />
                        </td>
                      </tr>
                    </table>
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
