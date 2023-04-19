import { LinkModel, PanelData, renderMarkdown } from '@grafana/data';
import { getTemplateSrv, locationService, reportInteraction } from '@grafana/runtime';
import { PanelPadding } from '@grafana/ui';
import { InspectTab } from 'app/features/inspector/types';
import { getPanelLinksSupplier } from 'app/features/panel/panellinks/linkSuppliers';
import { plugin } from 'app/plugins/panel/alertGroups/module';

import { DashboardModel, PanelModel } from '../state';

export function getPanelChromeProps(panel: PanelModel, dashboard: DashboardModel, data: PanelData) {
  let descriptionInteractionReported = false;

  function hasOverlayHeader() {
    // always show normal header if we have time override
    if (data.request && data.request.timeInfo) {
      return false;
    }

    return !panel.hasTitle();
  }

  const onShowPanelDescription = () => {
    const descriptionMarkdown = getTemplateSrv().replace(panel.description, panel.scopedVars);
    const interpolatedDescription = renderMarkdown(descriptionMarkdown);

    if (!descriptionInteractionReported) {
      // Description rendering function can be called multiple times due to re-renders but we want to report the interaction once.
      reportInteraction('dashboards_panelheader_description_displayed');
      descriptionInteractionReported = true;
    }

    return interpolatedDescription;
  };

  const onShowPanelLinks = (): LinkModel[] => {
    const linkSupplier = getPanelLinksSupplier(panel);
    if (!linkSupplier) {
      return [];
    }
    const panelLinks = linkSupplier && linkSupplier.getLinks(panel.replaceVariables);

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
    locationService.partial({ inspect: panel.id, inspectTab: tab });
  };

  const onOpenErrorInspect = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    locationService.partial({ inspect: panel.id, inspectTab: InspectTab.Error });
    reportInteraction('dashboards_panelheader_statusmessage_clicked');
  };

  const onCancelQuery = () => {
    panel.getQueryRunner().cancelQuery();
    reportInteraction('dashboards_panelheader_cancelquery_clicked', { data_state: data.state });
  };

  const padding: PanelPadding = plugin.noPadding ? 'none' : 'md';

  const getPanelHeaderTitleItemsProps = () => {
    const alertState = data.alertState?.state;
    const showTitleItems =
      (panel.links && panel.links.length > 0 && onShowPanelLinks) ||
      (data.series.length > 0 && data.series.some((v) => (v.meta?.notices?.length ?? 0) > 0)) ||
      (data.request && data.request.timeInfo) ||
      alertState;

    if (!showTitleItems) {
      return null;
    }

    return {
      alertState,
      data,
      panelId: panel.id,
      panelLinks: panel.links,
      onShowPanelLinks: onShowPanelLinks,
    };
  };

  return {
    hasOverlayHeader,
    onShowPanelDescription,
    onShowPanelLinks,
    onOpenInspector,
    onOpenErrorInspect,
    onCancelQuery,
    padding,
    getPanelHeaderTitleItemsProps,
  };
}
