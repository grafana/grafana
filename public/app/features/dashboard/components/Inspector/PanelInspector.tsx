import React, { PureComponent } from 'react';
import { Unsubscribable } from 'rxjs';
import AutoSizer from 'react-virtualized-auto-sizer';
import { connect, MapStateToProps } from 'react-redux';
import { saveAs } from 'file-saver';
import { InspectHeader } from './InspectHeader';
import { InspectJSONTab } from './InspectJSONTab';
import { QueryInspector } from './QueryInspector';

import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { JSONFormatter, Drawer, LegacyForms, Table, TabContent, CustomScrollbar, Button, Icon } from '@grafana/ui';
const { Select } = LegacyForms;
import { getLocationSrv, getDataSourceSrv } from '@grafana/runtime';
import {
  DataFrame,
  DataSourceApi,
  SelectableValue,
  getDisplayProcessor,
  applyFieldOverrides,
  toCSV,
  DataQueryError,
  PanelData,
  FieldType,
  formattedValueToString,
  QueryResultMetaStat,
  LoadingState,
  PanelPlugin,
} from '@grafana/data';
import { config } from 'app/core/config';
import { getPanelInspectorStyles } from './styles';
import { StoreState } from 'app/types';

interface OwnProps {
  dashboard: DashboardModel;
  panel: PanelModel;
  defaultTab: InspectTab;
}

export interface ConnectedProps {
  plugin?: PanelPlugin | null;
}

export type Props = OwnProps & ConnectedProps;

export enum InspectTab {
  Data = 'data',
  Meta = 'meta', // When result metadata exists
  Error = 'error',
  Stats = 'stats',
  JSON = 'json',
  Query = 'query',
}

interface State {
  isLoading: boolean;
  // The last raw response
  last: PanelData;
  // Data from the last response
  data: DataFrame[];
  // The selected data frame
  selected: number;
  // The Selected Tab
  currentTab: InspectTab;
  // If the datasource supports custom metadata
  metaDS?: DataSourceApi;
  // drawer width
  drawerWidth: string;
  // after plugin is loaded
  isInitialized: boolean;
}

export class PanelInspectorUnconnected extends PureComponent<Props, State> {
  querySubscription?: Unsubscribable;

  constructor(props: Props) {
    super(props);

    this.state = {
      isLoading: true,
      isInitialized: false,
      last: {} as PanelData,
      data: [],
      selected: 0,
      currentTab: props.defaultTab ?? InspectTab.Data,
      drawerWidth: '50%',
    };
  }

  componentDidMount() {
    const { plugin } = this.props;

    if (plugin) {
      this.init();
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.plugin !== this.props.plugin) {
      this.init();
    }
  }

  /**
   * This init process where we do not have a plugin to start with is to handle full page reloads with inspect url parameter
   * When this inspect drawer loads the plugin is not yet loaded.
   */
  init() {
    const { plugin, panel } = this.props;

    if (plugin && !plugin.meta.skipDataQuery) {
      this.querySubscription = panel
        .getQueryRunner()
        .getData()
        .subscribe({
          next: data => this.onUpdateData(data),
        });
    }
  }

  componentWillUnmount() {
    if (this.querySubscription) {
      this.querySubscription.unsubscribe();
    }
  }

  async onUpdateData(lastResult: PanelData) {
    let metaDS: DataSourceApi;
    const data = lastResult.series;
    const error = lastResult.error;

    const targets = lastResult.request?.targets || [];

    // Find the first DataSource wanting to show custom metadata
    if (data && targets.length) {
      for (const frame of data) {
        if (frame.meta && frame.meta.custom) {
          // get data source from first query
          const dataSource = await getDataSourceSrv().get(targets[0].datasource);

          if (dataSource && dataSource.components?.MetadataInspector) {
            metaDS = dataSource;
            break;
          }
        }
      }
    }

    // Set last result, but no metadata inspector
    this.setState(prevState => ({
      isLoading: lastResult.state === LoadingState.Loading,
      last: lastResult,
      data,
      metaDS,
      currentTab: error ? InspectTab.Error : prevState.currentTab,
    }));
  }

  onClose = () => {
    getLocationSrv().update({
      query: { inspect: null, inspectTab: null },
      partial: true,
    });
  };

  onToggleExpand = () => {
    this.setState(prevState => ({
      drawerWidth: prevState.drawerWidth === '100%' ? '40%' : '100%',
    }));
  };

  onSelectTab = (item: SelectableValue<InspectTab>) => {
    this.setState({ currentTab: item.value || InspectTab.Data });
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
    return <metaDS.components.MetadataInspector datasource={metaDS} data={data} />;
  }

  renderDataTab() {
    const { data, selected, isLoading: loading } = this.state;
    const styles = getPanelInspectorStyles();

    if (loading) {
      return (
        <div>
          Loading <Icon name="fa fa-spinner" className="fa-spin" size="lg" />
        </div>
      );
    }

    if (!data || !data.length) {
      return <div>No Data</div>;
    }

    const choices = data.map((frame, index) => {
      return {
        value: index,
        label: `${frame.name} (${index})`,
      };
    });

    const processed = applyFieldOverrides({
      data,
      theme: config.theme,
      fieldConfig: { defaults: {}, overrides: [] },
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
            <Button variant="primary" onClick={() => this.exportCsv(processed[selected])}>
              Download CSV
            </Button>
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

  renderErrorTab(error?: DataQueryError) {
    if (!error) {
      return null;
    }
    if (error.data) {
      return (
        <>
          <h3>{error.data.message}</h3>
          <JSONFormatter json={error} open={2} />
        </>
      );
    }
    return <div>{error.message}</div>;
  }

  renderStatsTab() {
    const { last } = this.state;
    const { request } = last;

    if (!request) {
      return null;
    }

    let stats: QueryResultMetaStat[] = [];

    const requestTime = request.endTime ? request.endTime - request.startTime : -1;
    const processingTime = last.timings?.dataProcessingTime || -1;
    let dataRows = 0;

    for (const frame of last.series) {
      dataRows += frame.length;
    }

    stats.push({ title: 'Total request time', value: requestTime, unit: 'ms' });
    stats.push({ title: 'Data processing time', value: processingTime, unit: 'ms' });
    stats.push({ title: 'Number of queries', value: request.targets.length });
    stats.push({ title: 'Total number rows', value: dataRows });

    let dataStats: QueryResultMetaStat[] = [];

    for (const series of last.series) {
      if (series.meta && series.meta.stats) {
        dataStats = dataStats.concat(series.meta.stats);
      }
    }

    return (
      <>
        {this.renderStatsTable('Stats', stats)}
        {this.renderStatsTable('Data source stats', dataStats)}
      </>
    );
  }

  renderStatsTable(name: string, stats: QueryResultMetaStat[]) {
    if (!stats || !stats.length) {
      return null;
    }

    return (
      <div style={{ paddingBottom: '16px' }}>
        <div className="section-heading">{name}</div>
        <table className="filter-table width-30">
          <tbody>
            {stats.map((stat, index) => {
              return (
                <tr key={`${stat.title}-${index}`}>
                  <td>{stat.title}</td>
                  <td style={{ textAlign: 'right' }}>{formatStat(stat)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  drawerHeader = () => {
    const { dashboard, panel, plugin } = this.props;
    const { currentTab, last } = this.state;
    const error = last?.error;
    const tabs = [];

    if (plugin && !plugin.meta.skipDataQuery) {
      tabs.push({ label: 'Data', value: InspectTab.Data });
      tabs.push({ label: 'Stats', value: InspectTab.Stats });
    }

    if (this.state.metaDS) {
      tabs.push({ label: 'Meta Data', value: InspectTab.Meta });
    }

    tabs.push({ label: 'JSON', value: InspectTab.JSON });

    if (error && error.message) {
      tabs.push({ label: 'Error', value: InspectTab.Error });
    }

    if (dashboard.meta.canEdit) {
      tabs.push({ label: 'Query', value: InspectTab.Query });
    }

    // Validate that the active tab is actually valid and allowed
    let activeTab = currentTab;
    if (!tabs.find(item => item.value === currentTab)) {
      activeTab = InspectTab.JSON;
    }

    return (
      <InspectHeader
        tabs={tabs}
        tab={activeTab}
        panelData={last}
        onSelectTab={this.onSelectTab}
        onClose={this.onClose}
        panel={panel}
        onToggleExpand={this.onToggleExpand}
        isExpanded={this.state.drawerWidth === '100%'}
      />
    );
  };

  render() {
    const { panel, dashboard, plugin } = this.props;
    const { last, currentTab: tab, drawerWidth } = this.state;
    const styles = getPanelInspectorStyles();
    const error = last?.error;

    if (!plugin) {
      return null;
    }

    return (
      <Drawer title={this.drawerHeader} width={drawerWidth} onClose={this.onClose}>
        <TabContent className={styles.tabContent}>
          {tab === InspectTab.Data && this.renderDataTab()}
          <CustomScrollbar autoHeightMin="100%">
            {tab === InspectTab.Meta && this.renderMetadataInspector()}
            {tab === InspectTab.JSON && (
              <InspectJSONTab panel={panel} dashboard={dashboard} data={last} onClose={this.onClose} />
            )}
            {tab === InspectTab.Error && this.renderErrorTab(error)}
            {tab === InspectTab.Stats && this.renderStatsTab()}
            {tab === InspectTab.Query && <QueryInspector panel={panel} />}
          </CustomScrollbar>
        </TabContent>
      </Drawer>
    );
  }
}

function formatStat(stat: QueryResultMetaStat): string {
  const display = getDisplayProcessor({
    field: {
      type: FieldType.number,
      config: stat,
    },
    theme: config.theme,
  });
  return formattedValueToString(display(stat.value));
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state, props) => {
  const panelState = state.dashboard.panels[props.panel.id];
  if (!panelState) {
    return { plugin: null };
  }

  return {
    plugin: panelState.plugin,
  };
};

export const PanelInspector = connect(mapStateToProps)(PanelInspectorUnconnected);
