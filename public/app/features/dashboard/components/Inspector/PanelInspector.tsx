import React, { PureComponent } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { saveAs } from 'file-saver';
import { css } from 'emotion';

import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import {
  JSONFormatter,
  Drawer,
  Select,
  Table,
  TabsBar,
  Tab,
  TabContent,
  Forms,
  stylesFactory,
  CustomScrollbar,
} from '@grafana/ui';
import { getLocationSrv, getDataSourceSrv } from '@grafana/runtime';
import {
  DataFrame,
  DataSourceApi,
  SelectableValue,
  applyFieldOverrides,
  toCSV,
  DataQueryError,
  PanelData,
} from '@grafana/data';
import { config } from 'app/core/config';

interface Props {
  dashboard: DashboardModel;
  panel: PanelModel;
  selectedTab: InspectTab;
}

export enum InspectTab {
  Data = 'data',
  Raw = 'raw',
  Issue = 'issue',
  Meta = 'meta', // When result metadata exists
  Error = 'error',
}

interface State {
  // The last raw response
  last?: PanelData;

  // Data frem the last response
  data: DataFrame[];

  // The selected data frame
  selected: number;

  // The Selected Tab
  tab: InspectTab;

  // If the datasource supports custom metadata
  metaDS?: DataSourceApi;
}

const getStyles = stylesFactory(() => {
  return {
    toolbar: css`
      display: flex;
      margin: 8px 0;
      justify-content: flex-end;
      align-items: center;
    `,
    dataFrameSelect: css`
      flex-grow: 2;
    `,
    downloadCsv: css`
      margin-left: 16px;
    `,
    tabContent: css`
      height: calc(100% - 32px);
    `,
    dataTabContent: css`
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
    `,
  };
});

export class PanelInspector extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      data: [],
      selected: 0,
      tab: props.selectedTab || InspectTab.Data,
    };
  }

  async componentDidMount() {
    const { panel } = this.props;
    if (!panel) {
      this.onDismiss(); // Try to close the component
      return;
    }

    const lastResult = panel.getQueryRunner().getLastResult();
    if (!lastResult) {
      this.onDismiss(); // Usually opened from refresh?
      return;
    }

    // Find the first DataSource wanting to show custom metadata
    let metaDS: DataSourceApi;
    const data = lastResult?.series;
    const error = lastResult?.error;

    if (data) {
      for (const frame of data) {
        const key = frame.meta?.datasource;
        if (key) {
          const dataSource = await getDataSourceSrv().get(key);
          if (dataSource && dataSource.components?.MetadataInspector) {
            metaDS = dataSource;
            break;
          }
        }
      }
    }

    // Set last result, but no metadata inspector
    this.setState(prevState => ({
      last: lastResult,
      data,
      metaDS,
      tab: error ? InspectTab.Error : prevState.tab,
    }));
  }

  onDismiss = () => {
    getLocationSrv().update({
      query: { inspect: null, tab: null },
      partial: true,
    });
  };

  onSelectTab = (item: SelectableValue<InspectTab>) => {
    this.setState({ tab: item.value || InspectTab.Data });
  };

  onSelectedFrameChanged = (item: SelectableValue<number>) => {
    this.setState({ selected: item.value || 0 });
  };

  exportCsv = (dataFrame: DataFrame) => {
    const dataFrameCsv = toCSV([dataFrame]);

    const blob = new Blob([dataFrameCsv], {
      type: 'application/csv;charset=utf-8',
    });

    saveAs(blob, dataFrame.name + '-' + new Date().getUTCDate() + '.csv');
  };

  renderMetadataInspector() {
    const { metaDS, data } = this.state;
    if (!metaDS || !metaDS.components?.MetadataInspector) {
      return <div>No Metadata Inspector</div>;
    }
    return (
      <CustomScrollbar>
        <metaDS.components.MetadataInspector datasource={metaDS} data={data} />
      </CustomScrollbar>
    );
  }

  renderDataTab() {
    const { data, selected } = this.state;
    const styles = getStyles();

    if (!data || !data.length) {
      return <div>No Data</div>;
    }
    const choices = data.map((frame, index) => {
      return {
        value: index,
        label: `${frame.name} (${index})`,
      };
    });

    // Apply dummy styles
    const processed = applyFieldOverrides({
      data,
      theme: config.theme,
      fieldOptions: { defaults: {}, overrides: [] },
      replaceVariables: (value: string) => {
        return value;
      },
    });

    return (
      <div className={styles.dataTabContent}>
        <div className={styles.toolbar}>
          {choices.length > 1 && (
            <div className={styles.dataFrameSelect}>
              <Select
                options={choices}
                value={choices.find(t => t.value === selected)}
                onChange={this.onSelectedFrameChanged}
              />
            </div>
          )}
          <div className={styles.downloadCsv}>
            <Forms.Button variant="primary" onClick={() => this.exportCsv(processed[selected])}>
              Download CSV
            </Forms.Button>
          </div>
        </div>
        <div style={{ flexGrow: 1 }}>
          <AutoSizer>
            {({ width, height }) => {
              if (width === 0) {
                return null;
              }
              return (
                <div style={{ width, height }}>
                  <Table width={width} height={height} data={processed[selected]} />
                </div>
              );
            }}
          </AutoSizer>
        </div>
      </div>
    );
  }

  renderIssueTab() {
    return <CustomScrollbar>TODO: show issue form</CustomScrollbar>;
  }

  renderErrorTab(error?: DataQueryError) {
    if (!error) {
      return null;
    }
    if (error.data) {
      return (
        <CustomScrollbar>
          <h3>{error.data.message}</h3>
          <pre>
            <code>{error.data.error}</code>
          </pre>
        </CustomScrollbar>
      );
    }
    return <div>{error.message}</div>;
  }

  renderRawJsonTab(last: PanelData) {
    return (
      <CustomScrollbar>
        <JSONFormatter json={last} open={2} />
      </CustomScrollbar>
    );
  }

  render() {
    const { panel } = this.props;
    const { last, tab } = this.state;
    const styles = getStyles();

    const error = last?.error;
    if (!panel) {
      this.onDismiss(); // Try to close the component
      return null;
    }

    const tabs = [];
    if (last && last?.series?.length > 0) {
      tabs.push({ label: 'Data', value: InspectTab.Data });
    }
    if (this.state.metaDS) {
      tabs.push({ label: 'Meta Data', value: InspectTab.Meta });
    }
    if (error && error.message) {
      tabs.push({ label: 'Error', value: InspectTab.Error });
    }
    tabs.push({ label: 'Raw JSON', value: InspectTab.Raw });

    return (
      <Drawer title={panel.title} onClose={this.onDismiss}>
        <TabsBar>
          {tabs.map((t, index) => {
            return (
              <Tab
                key={`${t.value}-${index}`}
                label={t.label}
                active={t.value === tab}
                onChangeTab={() => this.onSelectTab(t)}
              />
            );
          })}
        </TabsBar>
        <TabContent className={styles.tabContent}>
          {tab === InspectTab.Data ? (
            this.renderDataTab()
          ) : (
            <AutoSizer>
              {({ width, height }) => {
                if (width === 0) {
                  return null;
                }
                return (
                  <div style={{ width, height }}>
                    {tab === InspectTab.Meta && this.renderMetadataInspector()}
                    {tab === InspectTab.Issue && this.renderIssueTab()}
                    {tab === InspectTab.Raw && this.renderRawJsonTab(last)}
                    {tab === InspectTab.Error && this.renderErrorTab(error)}
                  </div>
                );
              }}
            </AutoSizer>
          )}
        </TabContent>
      </Drawer>
    );
  }
}
