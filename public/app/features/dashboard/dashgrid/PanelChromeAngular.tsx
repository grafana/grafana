// Libraries
import React, { PureComponent } from 'react';
import classNames from 'classnames';
// Components
import { PanelHeader } from './PanelHeader/PanelHeader';
// Utils & Services
/* import { profiler } from 'app/core/profiler'; */
import { getTimeSrv, TimeSrv } from '../services/TimeSrv';
import { getAngularLoader, AngularComponent } from '@grafana/runtime';
/* import config from 'app/core/config'; */
// Types
import { DashboardModel, PanelModel } from '../state';
/* import { PANEL_BORDER } from 'app/core/constants'; */
import { LoadingState, DefaultTimeRange, PanelData, PanelPlugin } from '@grafana/data';

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
  angularPanel?: AngularComponent;
  data: PanelData;
  errorMessage?: string;
}

export class PanelChromeAngular extends PureComponent<Props, State> {
  timeSrv: TimeSrv = getTimeSrv();
  element?: HTMLElement;

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
  }

  componentWillUnmount() {
    this.cleanUpAngularPanel();
  }

  componentDidUpdate() {
    if (!this.element || this.state.angularPanel) {
      return;
    }

    const loader = getAngularLoader();
    const template = '<plugin-component type="panel" class="panel-height-helper"></plugin-component>';
    const scopeProps = { panel: this.props.panel, dashboard: this.props.dashboard };
    const angularPanel = loader.load(this.element, scopeProps, template);

    this.setState({ angularPanel });
  }

  cleanUpAngularPanel() {
    if (this.state.angularPanel) {
      this.state.angularPanel.destroy();
      this.element = null;
    }
  }

  /* private renderLoadingState(): JSX.Element { */
  /*   return ( */
  /*     <div className="panel-loading"> */
  /*       <i className="fa fa-spinner fa-spin" /> */
  /*     </div> */
  /*   ); */
  /* } */

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
        />
        <div className={panelContentClassNames}>
          <div ref={element => (this.element = element)} className="panel-height-helper" />
        </div>
      </div>
    );
  }
}
