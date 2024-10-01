import { PureComponent } from 'react';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { Subscription } from 'rxjs';

import { getDefaultTimeRange, LoadingState, PanelData, PanelPlugin } from '@grafana/data';
import { AngularComponent, getAngularLoader } from '@grafana/runtime';
import { PanelChrome } from '@grafana/ui';
import config from 'app/core/config';
import { PANEL_BORDER } from 'app/core/constants';
import { setPanelAngularComponent } from 'app/features/panel/state/reducers';
import { getPanelStateForModel } from 'app/features/panel/state/selectors';
import { StoreState } from 'app/types';

import { getTimeSrv, TimeSrv } from '../services/TimeSrv';
import { DashboardModel, PanelModel } from '../state';
import { getPanelChromeProps } from '../utils/getPanelChromeProps';

import { PanelHeaderMenuWrapper } from './PanelHeader/PanelHeaderMenuWrapper';

interface OwnProps {
  panel: PanelModel;
  dashboard: DashboardModel;
  plugin: PanelPlugin;
  isViewing: boolean;
  isEditing: boolean;
  isInView: boolean;
  isDraggable?: boolean;
  width: number;
  height: number;
  hideMenu?: boolean;
}

interface ConnectedProps {
  angularComponent?: AngularComponent;
}

interface DispatchProps {
  setPanelAngularComponent: typeof setPanelAngularComponent;
}

export type Props = OwnProps & ConnectedProps & DispatchProps;

export interface State {
  data: PanelData;
  errorMessage?: string;
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
  subs = new Subscription();
  constructor(props: Props) {
    super(props);
    this.state = {
      data: {
        state: LoadingState.NotStarted,
        series: [],
        timeRange: getDefaultTimeRange(),
      },
    };
  }

  componentDidMount() {
    const { panel } = this.props;
    this.loadAngularPanel();

    // subscribe to data events
    const queryRunner = panel.getQueryRunner();

    // we are not displaying any of this data so no need for transforms or field config
    this.subs.add(
      queryRunner.getData({ withTransforms: false, withFieldConfig: false }).subscribe({
        next: (data: PanelData) => this.onPanelDataUpdate(data),
      })
    );
  }

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
    this.subs.unsubscribe();
    if (this.props.angularComponent) {
      this.props.angularComponent?.destroy();
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const { plugin, height, width, panel } = this.props;

    if (prevProps.plugin !== plugin) {
      this.loadAngularPanel();
    }

    if (prevProps.width !== width || prevProps.height !== height) {
      if (this.scopeProps) {
        this.scopeProps.size.height = this.getInnerPanelHeight();
        this.scopeProps.size.width = this.getInnerPanelWidth();
        panel.render();
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
      key: panel.key,
      angularComponent: loader.load(this.element, this.scopeProps, template),
    });
  }

  hasOverlayHeader() {
    const { panel } = this.props;
    const { data } = this.state;

    // always show normal header if we have time override
    if (data.request && data.request.timeInfo) {
      return false;
    }

    return !panel.hasTitle();
  }

  render() {
    const { dashboard, panel } = this.props;
    const { errorMessage, data } = this.state;
    const { transparent } = panel;

    const panelChromeProps = getPanelChromeProps({ ...this.props, data });

    // Shift the hover menu down if it's on the top row so it doesn't get clipped by topnav
    const hoverHeaderOffset = (panel.gridPos?.y ?? 0) === 0 ? -16 : undefined;

    const menu = (
      <div data-testid="panel-dropdown">
        <PanelHeaderMenuWrapper panel={panel} dashboard={dashboard} loadingState={data.state} />
      </div>
    );

    return (
      <PanelChrome
        width={this.props.width}
        height={this.props.height}
        title={panelChromeProps.title}
        loadingState={data.state}
        statusMessage={errorMessage}
        statusMessageOnClick={panelChromeProps.onOpenErrorInspect}
        description={panelChromeProps.description}
        titleItems={panelChromeProps.titleItems}
        menu={this.props.hideMenu ? undefined : menu}
        dragClass={panelChromeProps.dragClass}
        dragClassCancel="grid-drag-cancel"
        padding={panelChromeProps.padding}
        hoverHeaderOffset={hoverHeaderOffset}
        hoverHeader={panelChromeProps.hasOverlayHeader()}
        displayMode={transparent ? 'transparent' : 'default'}
        onCancelQuery={panelChromeProps.onCancelQuery}
      >
        {() => <div ref={(element) => (this.element = element)} className="panel-height-helper" />}
      </PanelChrome>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state, props) => {
  return {
    angularComponent: getPanelStateForModel(state, props.panel)?.angularComponent,
  };
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = { setPanelAngularComponent };

export const PanelChromeAngular = connect(mapStateToProps, mapDispatchToProps)(PanelChromeAngularUnconnected);
