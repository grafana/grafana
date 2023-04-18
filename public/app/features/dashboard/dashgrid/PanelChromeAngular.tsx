import classNames from 'classnames';
import React, { PureComponent } from 'react';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { Subscription } from 'rxjs';

import { getDefaultTimeRange, LinkModel, LoadingState, PanelData, PanelPlugin, renderMarkdown } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import {
  AngularComponent,
  getAngularLoader,
  getTemplateSrv,
  locationService,
  reportInteraction,
} from '@grafana/runtime';
import { PanelChrome, PanelPadding } from '@grafana/ui';
import config from 'app/core/config';
import { PANEL_BORDER } from 'app/core/constants';
import { InspectTab } from 'app/features/inspector/types';
import { getPanelLinksSupplier } from 'app/features/panel/panellinks/linkSuppliers';
import { setPanelAngularComponent } from 'app/features/panel/state/reducers';
import { getPanelStateForModel } from 'app/features/panel/state/selectors';
import { StoreState } from 'app/types';

import { isSoloRoute } from '../../../routes/utils';
import { getTimeSrv, TimeSrv } from '../services/TimeSrv';
import { DashboardModel, PanelModel } from '../state';

import { PanelHeader } from './PanelHeader/PanelHeader';
import { PanelHeaderMenuWrapperNew } from './PanelHeader/PanelHeaderMenuWrapper';
import { PanelHeaderTitleItems } from './PanelHeader/PanelHeaderTitleItems';

interface OwnProps {
  panel: PanelModel;
  dashboard: DashboardModel;
  plugin: PanelPlugin;
  isViewing: boolean;
  isEditing: boolean;
  isInView: boolean;
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
  descriptionInteractionReported = false;

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

  onShowPanelDescription() {
    const { panel } = this.props;
    const descriptionMarkdown = getTemplateSrv().replace(panel.description, panel.scopedVars);
    const interpolatedDescription = renderMarkdown(descriptionMarkdown);

    if (!this.descriptionInteractionReported) {
      // Description rendering function can be called multiple times due to re-renders but we want to report the interaction once.
      reportInteraction('dashboards_panelheader_description_displayed');
      this.descriptionInteractionReported = true;
    }

    return interpolatedDescription;
  }

  onShowPanelLinks(): LinkModel[] {
    const { panel } = this.props;
    const linkSupplier = getPanelLinksSupplier(panel);
    if (linkSupplier) {
      const panelLinks = linkSupplier && linkSupplier.getLinks(panel.replaceVariables);

      return panelLinks.map((panelLink) => ({
        ...panelLink,
        onClick: (...args) => {
          reportInteraction('dashboards_panelheader_datalink_clicked', { has_multiple_links: panelLinks.length > 1 });
          panelLink.onClick?.(...args);
        },
      }));
    }
    return [];
  }

  onOpenInspector(e: React.SyntheticEvent, tab: string) {
    e.stopPropagation();
    locationService.partial({ inspect: this.props.panel.id, inspectTab: tab });
  }

  onOpenErrorInspect(e: React.SyntheticEvent) {
    e.stopPropagation();
    locationService.partial({ inspect: this.props.panel.id, inspectTab: InspectTab.Error });
    reportInteraction('dashboards_panelheader_statusmessage_clicked');
  }

  onCancelQuery() {
    this.props.panel.getQueryRunner().cancelQuery();
    reportInteraction('dashboards_panelheader_cancelquery_clicked', { data_state: this.state.data.state });
  }

  render() {
    const { dashboard, panel, isViewing, isEditing, plugin } = this.props;
    const { errorMessage, data } = this.state;
    const { transparent } = panel;

    const alertState = data.alertState?.state;

    const containerClassNames = classNames({
      'panel-container': true,
      'panel-container--absolute': isSoloRoute(locationService.getLocation().pathname),
      'panel-container--transparent': transparent,
      'panel-container--no-title': this.hasOverlayHeader(),
      'panel-has-alert': panel.alert !== undefined,
      [`panel-alert-state--${alertState}`]: alertState !== undefined,
    });

    const panelContentClassNames = classNames({
      'panel-content': true,
      'panel-content--no-padding': plugin.noPadding,
    });

    const title = panel.getDisplayTitle();
    const padding: PanelPadding = plugin.noPadding ? 'none' : 'md';

    const showTitleItems =
      (panel.links && panel.links.length > 0 && this.onShowPanelLinks) ||
      (data.series.length > 0 && data.series.some((v) => (v.meta?.notices?.length ?? 0) > 0)) ||
      (data.request && data.request.timeInfo) ||
      alertState;

    const titleItems = showTitleItems && (
      <PanelHeaderTitleItems
        key="title-items"
        alertState={alertState}
        data={data}
        panelId={panel.id}
        panelLinks={panel.links}
        onShowPanelLinks={this.onShowPanelLinks}
      />
    );

    const dragClass = !(isViewing || isEditing) ? 'grid-drag-handle' : '';

    if (config.featureToggles.newPanelChromeUI) {
      // Shift the hover menu down if it's on the top row so it doesn't get clipped by topnav
      const hoverHeaderOffset = (panel.gridPos?.y ?? 0) === 0 ? -16 : undefined;

      const menu = (
        <div data-testid="panel-dropdown">
          <PanelHeaderMenuWrapperNew panel={panel} dashboard={dashboard} loadingState={data.state} />
        </div>
      );

      return (
        <PanelChrome
          width={this.props.width}
          height={this.props.height}
          title={title}
          loadingState={data.state}
          statusMessage={errorMessage}
          statusMessageOnClick={this.onOpenErrorInspect}
          description={!!panel.description ? this.onShowPanelDescription : undefined}
          titleItems={titleItems}
          menu={this.props.hideMenu ? undefined : menu}
          dragClass={dragClass}
          dragClassCancel="grid-drag-cancel"
          padding={padding}
          hoverHeaderOffset={hoverHeaderOffset}
          hoverHeader={this.hasOverlayHeader()}
          displayMode={transparent ? 'transparent' : 'default'}
          onCancelQuery={this.onCancelQuery}
        >
          {(width, height) => <div ref={(element) => (this.element = element)} className="panel-height-helper" />}
        </PanelChrome>
      );
    } else {
      return (
        <div
          className={containerClassNames}
          data-testid={selectors.components.Panels.Panel.title(panel.title)}
          aria-label={selectors.components.Panels.Panel.containerByTitle(panel.title)}
        >
          <PanelHeader
            panel={panel}
            dashboard={dashboard}
            title={panel.title}
            description={panel.description}
            links={panel.links}
            error={errorMessage}
            isViewing={isViewing}
            isEditing={isEditing}
            data={data}
            alertState={alertState}
          />
          <div className={panelContentClassNames}>
            <div ref={(element) => (this.element = element)} className="panel-height-helper" />
          </div>
        </div>
      );
    }
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state, props) => {
  return {
    angularComponent: getPanelStateForModel(state, props.panel)?.angularComponent,
  };
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = { setPanelAngularComponent };

export const PanelChromeAngular = connect(mapStateToProps, mapDispatchToProps)(PanelChromeAngularUnconnected);
