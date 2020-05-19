import React, { PureComponent } from 'react';
import { Unsubscribable } from 'rxjs';
import { connect, MapStateToProps } from 'react-redux';
import { InspectSubtitle } from './InspectSubtitle';
import { InspectJSONTab } from './InspectJSONTab';
import { QueryInspector } from './QueryInspector';

import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { CustomScrollbar, Drawer, JSONFormatter, TabContent } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { getDataSourceSrv, getLocationSrv } from '@grafana/runtime';
import {
  DataFrame,
  DataQueryError,
  DataSourceApi,
  FieldType,
  formattedValueToString,
  getDisplayProcessor,
  LoadingState,
  PanelData,
  PanelPlugin,
  QueryResultMetaStat,
  SelectableValue,
  TimeZone,
} from '@grafana/data';
import { config } from 'app/core/config';
import { getPanelInspectorStyles } from './styles';
import { StoreState } from 'app/types';
import { InspectDataTab } from './InspectDataTab';
import { supportsDataQuery } from '../PanelEditor/utils';
import { GetDataOptions } from '../../state/PanelQueryRunner';

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
  // The Selected Tab
  currentTab: InspectTab;
  // If the datasource supports custom metadata
  metaDS?: DataSourceApi;
  // drawer width
  drawerWidth: string;
  withTransforms: boolean;
  withFieldConfig: boolean;
}

export class PanelInspectorUnconnected extends PureComponent<Props, State> {
  querySubscription?: Unsubscribable;

  constructor(props: Props) {
    super(props);

    this.state = {
      isLoading: true,
      last: {} as PanelData,
      data: [],
      currentTab: props.defaultTab ?? InspectTab.Data,
      drawerWidth: '50%',
      withTransforms: true,
      withFieldConfig: false,
    };
  }

  componentDidMount() {
    const { plugin } = this.props;

    if (plugin) {
      this.init();
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (
      prevProps.plugin !== this.props.plugin ||
      this.state.withTransforms !== prevState.withTransforms ||
      this.state.withFieldConfig !== prevState.withFieldConfig
    ) {
      this.init();
    }
  }

  /**
   * This init process where we do not have a plugin to start with is to handle full page reloads with inspect url parameter
   * When this inspect drawer loads the plugin is not yet loaded.
   */
  init() {
    const { plugin, panel } = this.props;
    const { withTransforms, withFieldConfig } = this.state;

    if (plugin && !plugin.meta.skipDataQuery) {
      if (this.querySubscription) {
        this.querySubscription.unsubscribe();
      }
      this.querySubscription = panel
        .getQueryRunner()
        .getData({ withTransforms, withFieldConfig })
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
  onDataTabOptionsChange = (options: GetDataOptions) => {
    this.setState({ withTransforms: !!options.withTransforms, withFieldConfig: !!options.withFieldConfig });
  };

  renderMetadataInspector() {
    const { metaDS, data } = this.state;
    if (!metaDS || !metaDS.components?.MetadataInspector) {
      return <div>No Metadata Inspector</div>;
    }
    return <metaDS.components.MetadataInspector datasource={metaDS} data={data} />;
  }

  renderDataTab() {
    const { last, isLoading, withFieldConfig, withTransforms } = this.state;
    return (
      <InspectDataTab
        dashboard={this.props.dashboard}
        panel={this.props.panel}
        data={last.series}
        isLoading={isLoading}
        options={{
          withFieldConfig,
          withTransforms,
        }}
        onOptionsChange={this.onDataTabOptionsChange}
      />
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

    stats.push({ displayName: 'Total request time', value: requestTime, unit: 'ms' });
    stats.push({ displayName: 'Data processing time', value: processingTime, unit: 'ms' });
    stats.push({ displayName: 'Number of queries', value: request.targets.length });
    stats.push({ displayName: 'Total number rows', value: dataRows });

    let dataStats: QueryResultMetaStat[] = [];

    for (const series of last.series) {
      if (series.meta && series.meta.stats) {
        dataStats = dataStats.concat(series.meta.stats);
      }
    }

    return (
      <div aria-label={selectors.components.PanelInspector.Stats.content}>
        {this.renderStatsTable('Stats', stats)}
        {this.renderStatsTable('Data source stats', dataStats)}
      </div>
    );
  }

  renderStatsTable(name: string, stats: QueryResultMetaStat[]) {
    if (!stats || !stats.length) {
      return null;
    }

    const { dashboard } = this.props;

    return (
      <div style={{ paddingBottom: '16px' }}>
        <table className="filter-table width-30">
          <tbody>
            {stats.map((stat, index) => {
              return (
                <tr key={`${stat.displayName}-${index}`}>
                  <td>{stat.displayName}</td>
                  <td style={{ textAlign: 'right' }}>{formatStat(stat, dashboard.getTimezone())}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  drawerSubtitle(tabs: Array<{ label: string; value: InspectTab }>, activeTab: InspectTab) {
    const { last } = this.state;

    return <InspectSubtitle tabs={tabs} tab={activeTab} panelData={last} onSelectTab={this.onSelectTab} />;
  }

  getTabs() {
    const { dashboard, plugin } = this.props;
    const { last } = this.state;
    const error = last?.error;
    const tabs = [];

    if (supportsDataQuery(plugin)) {
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

    if (dashboard.meta.canEdit && supportsDataQuery(plugin)) {
      tabs.push({ label: 'Query', value: InspectTab.Query });
    }
    return tabs;
  }

  render() {
    const { panel, dashboard, plugin } = this.props;
    const { currentTab } = this.state;

    if (!plugin) {
      return null;
    }

    const { last, drawerWidth } = this.state;
    const styles = getPanelInspectorStyles();
    const error = last?.error;
    const tabs = this.getTabs();

    // Validate that the active tab is actually valid and allowed
    let activeTab = currentTab;
    if (!tabs.find(item => item.value === currentTab)) {
      activeTab = InspectTab.JSON;
    }

    return (
      <Drawer
        title={`Inspect: ${panel.title}` || 'Panel inspect'}
        subtitle={this.drawerSubtitle(tabs, activeTab)}
        width={drawerWidth}
        onClose={this.onClose}
        expandable
      >
        {activeTab === InspectTab.Data && this.renderDataTab()}
        <CustomScrollbar autoHeightMin="100%">
          <TabContent className={styles.tabContent}>
            {activeTab === InspectTab.Meta && this.renderMetadataInspector()}
            {activeTab === InspectTab.JSON && (
              <InspectJSONTab panel={panel} dashboard={dashboard} data={last} onClose={this.onClose} />
            )}
            {activeTab === InspectTab.Error && this.renderErrorTab(error)}
            {activeTab === InspectTab.Stats && this.renderStatsTab()}
            {activeTab === InspectTab.Query && <QueryInspector panel={panel} />}
          </TabContent>
        </CustomScrollbar>
      </Drawer>
    );
  }
}

function formatStat(stat: QueryResultMetaStat, timeZone?: TimeZone): string {
  const display = getDisplayProcessor({
    field: {
      type: FieldType.number,
      config: stat,
    },
    theme: config.theme,
    timeZone,
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
