// Libraries
import React, { PureComponent } from 'react';
import classNames from 'classnames';
import { Unsubscribable } from 'rxjs';
// Components
import { PanelHeader } from './PanelHeader/PanelHeader';
// Utils & Services
/* import { profiler } from 'app/core/profiler'; */
import { getTimeSrv, TimeSrv } from '../services/TimeSrv';
import { getAngularLoader } from '@grafana/runtime';
/* import config from 'app/core/config'; */
// Types
import { DashboardModel, PanelModel } from '../state';
import { LoadingState, DefaultTimeRange, PanelData, PanelPlugin, PanelEvents } from '@grafana/data';
/* import { PANEL_BORDER } from 'app/core/constants'; */

/* const DEFAULT_PLUGIN_ERROR = 'Error in plugin'; */

export interface Props {
  panel: PanelModel;
  dashboard: DashboardModel;
  plugin: PanelPlugin;
  isFullscreen: boolean;
  isInView: boolean;
  width: number;
  height: number;
}

export interface State {
  data: PanelData;
  errorMessage?: string;
}

export class PanelChromeAngular extends PureComponent<Props, State> {
  element?: HTMLElement;
  timeSrv: TimeSrv = getTimeSrv();
  querySubscription: Unsubscribable;

  constructor(props: Props) {
    super(props);
    this.state = {
      data: {
        state: LoadingState.NotStarted,
        series: [],
        timeRange: DefaultTimeRange,
      },
    };
  }

  componentDidMount() {
    const { panel, dashboard } = this.props;
    dashboard.panelInitialized(panel);
    this.loadAngularPanel();

    // subscribe to data events
    const queryRunner = panel.getQueryRunner();
    this.querySubscription = queryRunner.getData(false).subscribe({
      next: (data: PanelData) => this.onPanelDataUpdate(data),
    });

    // Subscribe to render events (needed for some things like when title changed from angular general tab)
    // Need to find another solution for this in tthe future (panel title in redux?)
    panel.events.on(PanelEvents.render, this.onPanelRenderEvent);
  }

  onPanelRenderEvent = () => {
    this.forceUpdate();
  };

  onPanelDataUpdate(data: PanelData) {
    this.setState({ data });
  }

  componentWillUnmount() {
    this.cleanUpAngularPanel();

    if (this.querySubscription) {
      this.querySubscription.unsubscribe();
      this.querySubscription = null;
    }

    this.props.panel.events.off(PanelEvents.render, this.onPanelRenderEvent);
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (prevProps.plugin !== this.props.plugin) {
      this.cleanUpAngularPanel();
      this.loadAngularPanel();
    }

    this.loadAngularPanel();
  }

  loadAngularPanel() {
    const { panel, dashboard } = this.props;

    // if we have no element or already have loaded the panel return
    if (!this.element || panel.angularPanel) {
      return;
    }

    const loader = getAngularLoader();
    const template = '<plugin-component type="panel" class="panel-height-helper"></plugin-component>';
    const scopeProps = { panel: panel, dashboard: dashboard };
    const angularPanel = loader.load(this.element, scopeProps, template);

    panel.setAngularPanel(angularPanel);
  }

  cleanUpAngularPanel() {
    const { panel } = this.props;

    if (panel.angularPanel) {
      panel.destroy();
      panel.setAngularPanel(undefined);
    }
  }

  hasOverlayHeader() {
    const { panel } = this.props;
    const { errorMessage, data } = this.state;

    // always show normal header if we have an error message
    if (errorMessage) {
      return false;
    }

    // always show normal header if we have time override
    if (data.request && data.request.timeInfo) {
      return false;
    }

    return !panel.hasTitle();
  }

  render() {
    const { dashboard, panel, isFullscreen, plugin } = this.props;
    const { errorMessage, data } = this.state;
    const { transparent } = panel;

    const containerClassNames = classNames({
      'panel-container': true,
      'panel-container--absolute': true,
      'panel-container--transparent': transparent,
      'panel-container--no-title': this.hasOverlayHeader(),
    });

    const panelContentClassNames = classNames({
      'panel-content': true,
      'panel-content--no-padding': plugin.noPadding,
    });

    return (
      <div className={containerClassNames}>
        <PanelHeader
          panel={panel}
          dashboard={dashboard}
          timeInfo={data.request ? data.request.timeInfo : null}
          title={panel.title}
          description={panel.description}
          scopedVars={panel.scopedVars}
          links={panel.links}
          error={errorMessage}
          isFullscreen={isFullscreen}
          isLoading={data.state === LoadingState.Loading}
        />
        <div className={panelContentClassNames}>
          <div ref={element => (this.element = element)} className="panel-height-helper" />
        </div>
      </div>
    );
  }
}
