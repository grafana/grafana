// Libraries
import React, { ComponentClass, PureComponent } from 'react';

// Services
import { getTimeSrv } from '../time_srv';

// Components
import { PanelHeader } from './PanelHeader/PanelHeader';
import { DataPanel } from './DataPanel';
import { PanelHeaderMenu } from './PanelHeader/PanelHeaderMenu';

// Types
import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';
import { TimeRange, PanelProps } from 'app/types';
import { PanelHeaderGetMenuAdditional } from 'app/types/panel';

export interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  component: ComponentClass<PanelProps>;
  getMenuAdditional?: PanelHeaderGetMenuAdditional;
}

export interface State {
  refreshCounter: number;
  renderCounter: number;
  timeRange?: TimeRange;
}

export class PanelChrome extends PureComponent<Props, State> {
  constructor(props) {
    super(props);

    this.state = {
      refreshCounter: 0,
      renderCounter: 0,
    };
  }

  componentDidMount() {
    this.props.panel.events.on('refresh', this.onRefresh);
    this.props.panel.events.on('render', this.onRender);
    this.props.dashboard.panelInitialized(this.props.panel);
  }

  componentWillUnmount() {
    this.props.panel.events.off('refresh', this.onRefresh);
  }

  onRefresh = () => {
    const timeSrv = getTimeSrv();
    const timeRange = timeSrv.timeRange();

    this.setState(prevState => ({
      ...prevState,
      refreshCounter: this.state.refreshCounter + 1,
      timeRange: timeRange,
    }));
  };

  onRender = () => {
    console.log('onRender');
    this.setState(prevState => ({
      ...prevState,
      renderCounter: this.state.renderCounter + 1,
    }));
  };

  get isVisible() {
    return !this.props.dashboard.otherPanelInFullscreen(this.props.panel);
  }

  render() {
    const { panel, dashboard, getMenuAdditional } = this.props;
    const { refreshCounter, timeRange, renderCounter } = this.state;

    const { datasource, targets } = panel;
    const PanelComponent = this.props.component;
    const panelSpecificMenuOptions = getMenuAdditional(panel);
    const additionalMenuItems = panelSpecificMenuOptions.additionalMenuItems || undefined;
    const additionalSubMenuItems = panelSpecificMenuOptions.additionalSubMenuItems || undefined;

    console.log('panelChrome render');
    return (
      <div className="panel-container">
        <PanelHeader title={panel.title}>
          <PanelHeaderMenu
            panel={panel}
            dashboard={dashboard}
            additionalMenuItems={additionalMenuItems}
            additionalSubMenuItems={additionalSubMenuItems}
          />
        </PanelHeader>
        <div className="panel-content">
          <DataPanel
            datasource={datasource}
            queries={targets}
            timeRange={timeRange}
            isVisible={this.isVisible}
            refreshCounter={refreshCounter}
          >
            {({ loading, timeSeries }) => {
              console.log('panelcrome inner render');
              return (
                <PanelComponent
                  loading={loading}
                  timeSeries={timeSeries}
                  timeRange={timeRange}
                  options={panel.getOptions()}
                  renderCounter={renderCounter}
                />
              );
            }}
          </DataPanel>
        </div>
      </div>
    );
  }
}
