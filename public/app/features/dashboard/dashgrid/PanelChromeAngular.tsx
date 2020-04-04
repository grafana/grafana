// Libraries
import React, { PureComponent } from 'react';
import classNames from 'classnames';
import { Unsubscribable } from 'rxjs';
import { connect, MapStateToProps, MapDispatchToProps } from 'react-redux';

// Components
import { PanelHeader } from './PanelHeader/PanelHeader';

// Utils & Services
import { getTimeSrv, TimeSrv } from '../services/TimeSrv';
import { getAngularLoader, AngularComponent } from '@grafana/runtime';
import { setPanelAngularComponent } from '../state/reducers';
import config from 'app/core/config';

// Types
import { DashboardModel, PanelModel } from '../state';
import { StoreState } from 'app/types';
import { LoadingState, DefaultTimeRange, PanelData, PanelPlugin, PanelEvents } from '@grafana/data';
import { updateLocation } from 'app/core/actions';
import { PANEL_BORDER } from 'app/core/constants';

interface OwnProps {
  panel: PanelModel;
  dashboard: DashboardModel;
  plugin: PanelPlugin;
  isFullscreen: boolean;
  isInView: boolean;
  width: number;
  height: number;
}

interface ConnectedProps {
  angularComponent?: AngularComponent | null;
}

interface DispatchProps {
  setPanelAngularComponent: typeof setPanelAngularComponent;
  updateLocation: typeof updateLocation;
}

export type Props = OwnProps & ConnectedProps & DispatchProps;

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

export class PanelChromeAngularUnconnected extends PureComponent<Props, State> {
  element: HTMLElement | null = null;
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
    let errorMessage: string | undefined;

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
    }

    this.props.panel.events.off(PanelEvents.render, this.onPanelRenderEvent);
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const { plugin, height, width, panel } = this.props;

    if (prevProps.plugin !== plugin) {
      this.cleanUpAngularPanel();
      this.loadAngularPanel();
    }

    if (prevProps.width !== width || prevProps.height !== height) {
      if (this.scopeProps) {
        this.scopeProps.size.height = this.getInnerPanelHeight();
        this.scopeProps.size.width = this.getInnerPanelWidth();
        panel.events.emit(PanelEvents.panelSizeChanged);
      }
    }
  }

  getInnerPanelHeight() {
    const { plugin, height } = this.props;
    const { theme } = config;

    const headerHeight = this.hasOverlayHeader() ? 0 : theme.panelHeaderHeight;
    const chromePadding = plugin.noPadding ? 0 : theme.panelPadding;
    return height - headerHeight - chromePadding * 2 - PANEL_BORDER;
  }

  getInnerPanelWidth() {
    const { plugin, width } = this.props;
    const { theme } = config;

    const chromePadding = plugin.noPadding ? 0 : theme.panelPadding;
    return width - chromePadding * 2 - PANEL_BORDER;
  }

  loadAngularPanel() {
    const { panel, dashboard, setPanelAngularComponent } = this.props;

    // if we have no element or already have loaded the panel return
    if (!this.element) {
      return;
    }

    const loader = getAngularLoader();
    const template = '<plugin-component type="panel" class="panel-height-helper"></plugin-component>';

    this.scopeProps = {
      panel: panel,
      dashboard: dashboard,
      size: { width: this.getInnerPanelWidth(), height: this.getInnerPanelHeight() },
    };

    setPanelAngularComponent({
      panelId: panel.id,
      angularComponent: loader.load(this.element, this.scopeProps, template),
    });

    // need to to this every time we load an angular as all events are unsubscribed when panel is destroyed
    this.subscribeToRenderEvent();
  }

  cleanUpAngularPanel() {
    const { angularComponent, setPanelAngularComponent, panel } = this.props;

    if (angularComponent) {
      angularComponent.destroy();
    }

    setPanelAngularComponent({ panelId: panel.id, angularComponent: null });
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
    const { dashboard, panel, isFullscreen, plugin, angularComponent, updateLocation } = this.props;
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
          title={panel.title}
          description={panel.description}
          scopedVars={panel.scopedVars}
          angularComponent={angularComponent}
          links={panel.links}
          error={errorMessage}
          isFullscreen={isFullscreen}
          data={data}
          updateLocation={updateLocation}
        />
        <div className={panelContentClassNames}>
          <div ref={element => (this.element = element)} className="panel-height-helper" />
        </div>
      </div>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state, props) => {
  return {
    angularComponent: state.dashboard.panels[props.panel.id].angularComponent,
  };
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = { setPanelAngularComponent, updateLocation };

export const PanelChromeAngular = connect(mapStateToProps, mapDispatchToProps)(PanelChromeAngularUnconnected);
