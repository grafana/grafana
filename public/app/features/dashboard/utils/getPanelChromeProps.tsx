import React from 'react';

import { LinkModel, PanelData, PanelPlugin, renderMarkdown } from '@grafana/data';
import { getTemplateSrv, locationService, reportInteraction } from '@grafana/runtime';
import { PanelPadding } from '@grafana/ui';
import { InspectTab } from 'app/features/inspector/types';
import { getPanelLinksSupplier } from 'app/features/panel/panellinks/linkSuppliers';

import { PanelHeaderTitleItems } from '../dashgrid/PanelHeader/PanelHeaderTitleItems';
import { DashboardModel, PanelModel } from '../state';

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
  let descriptionInteractionReported = false;

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

    if (!descriptionInteractionReported) {
      // Description rendering function can be called multiple times due to re-renders but we want to report the interaction once.
      reportInteraction('dashboards_panelheader_description_displayed');
      descriptionInteractionReported = true;
    }

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
        reportInteraction('dashboards_panelheader_datalink_clicked', { has_multiple_links: panelLinks.length > 1 });
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
    reportInteraction('dashboards_panelheader_statusmessage_clicked');
  };

  const onCancelQuery = () => {
    props.panel.getQueryRunner().cancelQuery();
    reportInteraction('dashboards_panelheader_cancelquery_clicked', { data_state: props.data.state });
  };

  const padding: PanelPadding = props.plugin.noPadding ? 'none' : 'md';
  const alertState = props.data.alertState?.state;

  const showTitleItems =
    (props.panel.links && props.panel.links.length > 0 && onShowPanelLinks) ||
    (props.data.series.length > 0 && props.data.series.some((v) => (v.meta?.notices?.length ?? 0) > 0)) ||
    (props.data.request && props.data.request.timeInfo) ||
    alertState;

  const titleItems = showTitleItems && (
    <PanelHeaderTitleItems
      alertState={alertState}
      data={props.data}
      panelId={props.panel.id}
      panelLinks={props.panel.links}
      onShowPanelLinks={onShowPanelLinks}
    />
  );

  const description = props.panel.description ? onShowPanelDescription : undefined;

  const dragClass =
    !(props.isViewing || props.isEditing) && Boolean(props.isDraggable ?? true) ? 'grid-drag-handle' : '';

  const title = props.panel.getDisplayTitle();

  const onOpenMenu = () => {
    reportInteraction('dashboards_panelheader_menu', { item: 'menu' });
  };

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
    onOpenMenu,
  };
}
