import * as React from 'react';

import { LinkModel, PanelData, PanelPlugin, renderMarkdown } from '@grafana/data';
import { config, getTemplateSrv, locationService } from '@grafana/runtime';
import { PanelPadding } from '@grafana/ui';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { InspectTab } from 'app/features/inspector/types';
import { getPanelLinksSupplier } from 'app/features/panel/panellinks/linkSuppliers';
import { isAngularDatasourcePluginAndNotHidden } from 'app/features/plugins/angularDeprecation/utils';

import { PanelHeaderTitleItems } from '../dashgrid/PanelHeader/PanelHeaderTitleItems';
import { DashboardModel } from '../state/DashboardModel';
import { PanelModel } from '../state/PanelModel';

interface CommonProps {
  panel: PanelModel;
  data: PanelData;
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

export function getPanelChromeProps(props: CommonProps) {
  function hasOverlayHeader() {
    // always show normal header if we have time override
    if (props.data.request && props.data.request.timeInfo) {
      return false;
    }

    return !props.panel.hasTitle();
  }

  const onShowPanelDescription = () => {
    const descriptionMarkdown = getTemplateSrv().replace(props.panel.description, props.panel.scopedVars);
    const interpolatedDescription = renderMarkdown(descriptionMarkdown);

    return interpolatedDescription;
  };

  const onShowPanelLinks = (): LinkModel[] => {
    const linkSupplier = getPanelLinksSupplier(props.panel);
    if (!linkSupplier) {
      return [];
    }
    const panelLinks = linkSupplier && linkSupplier.getLinks(props.panel.replaceVariables);

    return panelLinks.map((panelLink) => ({
      ...panelLink,
      onClick: (...args) => {
        DashboardInteractions.panelLinkClicked({ has_multiple_links: panelLinks.length > 1 });
        panelLink.onClick?.(...args);
      },
    }));
  };

  const onOpenInspector = (e: React.SyntheticEvent, tab: string) => {
    e.stopPropagation();
    locationService.partial({ inspect: props.panel.id, inspectTab: tab });
  };

  const onOpenErrorInspect = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    locationService.partial({ inspect: props.panel.id, inspectTab: InspectTab.Error });
    DashboardInteractions.panelStatusMessageClicked();
  };

  const onCancelQuery = () => {
    props.panel.getQueryRunner().cancelQuery();
    DashboardInteractions.panelCancelQueryClicked({ data_state: props.data.state });
  };

  const padding: PanelPadding = props.plugin.noPadding ? 'none' : 'md';
  const alertState = props.data.alertState?.state;

  const isAngularDatasource = props.panel.datasource?.uid
    ? isAngularDatasourcePluginAndNotHidden(props.panel.datasource?.uid)
    : false;
  const isAngularPanel = props.panel.isAngularPlugin() && !props.plugin.meta.angular?.hideDeprecation;
  const showAngularNotice =
    (config.featureToggles.angularDeprecationUI ?? false) && (isAngularDatasource || isAngularPanel);

  const showTitleItems =
    (props.panel.links && props.panel.links.length > 0 && onShowPanelLinks) ||
    (props.data.series.length > 0 && props.data.series.some((v) => (v.meta?.notices?.length ?? 0) > 0)) ||
    (props.data.request && props.data.request.timeInfo) ||
    showAngularNotice ||
    alertState;

  const titleItems = showTitleItems && (
    <PanelHeaderTitleItems
      alertState={alertState}
      data={props.data}
      panelId={props.panel.id}
      panelLinks={props.panel.links}
      angularNotice={{
        show: showAngularNotice,
        isAngularDatasource,
        isAngularPanel,
      }}
      onShowPanelLinks={onShowPanelLinks}
    />
  );

  const description = props.panel.description ? onShowPanelDescription : undefined;

  const dragClass =
    !(props.isViewing || props.isEditing) && Boolean(props.isDraggable ?? true) ? 'grid-drag-handle' : '';

  const title = props.panel.getDisplayTitle();

  return {
    hasOverlayHeader,
    onShowPanelDescription,
    onShowPanelLinks,
    onOpenInspector,
    onOpenErrorInspect,
    onCancelQuery,
    padding,
    description,
    dragClass,
    title,
    titleItems,
  };
}
