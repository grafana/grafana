// Libraries
import React, { PureComponent } from 'react';
import classNames from 'classnames';
import { Unsubscribable } from 'rxjs';
// Components
import { PanelHeader } from './PanelHeader/PanelHeader';
// Utils & Services
import { getTimeSrv, TimeSrv } from '../services/TimeSrv';
import { getAngularLoader } from '@grafana/runtime';
// Types
import { DashboardModel, PanelModel } from '../state';
import { LoadingState, DefaultTimeRange, PanelData, PanelPlugin, PanelEvents } from '@grafana/data';

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
  alertState?: string;
}

interface AngularScopeProps {
  panel: PanelModel;
  dashboard: DashboardModel;
  size: {
    height: number;
    width: number;
  };
}

export class PanelChromeAngular extends PureComponent<Props, State> {
  element?: HTMLElement;
  timeSrv: TimeSrv = getTimeSrv();
  scopeProps?: AngularScopeProps;
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
    const { panel } = this.props;
    this.loadAngularPanel();

    // subscribe to data events
    const queryRunner = panel.getQueryRunner();
    this.querySubscription = queryRunner.getData(false).subscribe({
      next: (data: PanelData) => this.onPanelDataUpdate(data),
    });
  }

  subscribeToRenderEvent() {
    // Subscribe to render event, this is as far as I know only needed for changes to title & transparent
    // These changes are modified in the model and only way to communicate that change is via this event
    // Need to find another solution for this in tthe future (panel title in redux?)
    this.props.panel.events.on(PanelEvents.render, this.onPanelRenderEvent);
  }

  onPanelRenderEvent = (payload?: any) => {
    const { alertState } = this.state;

    if (payload && payload.alertState) {
      this.setState({ alertState: payload.alertState });
    } else if (payload && alertState) {
      this.setState({ alertState: undefined });
    } else {
      // only needed for detecting title updates right now fix before 7.0
      this.forceUpdate();
    }
  };

  onPanelDataUpdate(data: PanelData) {
    let errorMessage: string | null = null;

    if (data.state === LoadingState.Error) {
      const { error } = data;
      if (error) {
        if (errorMessage !== error.message) {
          errorMessage = error.message;
        }
      }
    }

    this.setState({ data, errorMessage });
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
  }

  loadAngularPanel() {
    const { panel, dashboard, height, width } = this.props;

    // if we have no element or already have loaded the panel return
    if (!this.element || panel.angularPanel) {
      this.scopeProps.size.height = height;
      this.scopeProps.size.width = width;
      return;
    }

    const loader = getAngularLoader();
    const template = '<plugin-component type="panel" class="panel-height-helper"></plugin-component>';

    this.scopeProps = {
      panel: panel,
      dashboard: dashboard,
      size: { width, height },
    };

    // compile angular template and get back handle to scope
    panel.setAngularPanel(loader.load(this.element, this.scopeProps, template));

    // need to to this every time we load an angular as all events are unsubscribed when panel is destroyed
    this.subscribeToRenderEvent();
  }

  cleanUpAngularPanel() {
    const { panel } = this.props;

    if (panel.angularPanel) {
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
    const { errorMessage, data, alertState } = this.state;
    const { transparent } = panel;

    const containerClassNames = classNames({
      'panel-container': true,
      'panel-container--absolute': true,
      'panel-container--transparent': transparent,
      'panel-container--no-title': this.hasOverlayHeader(),
      'panel-has-alert': panel.alert !== undefined,
      [`panel-alert-state--${alertState}`]: alertState !== undefined,
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
