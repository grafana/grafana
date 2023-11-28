import React from 'react';
import { renderMarkdown } from '@grafana/data';
import { config, getTemplateSrv, locationService, reportInteraction } from '@grafana/runtime';
import { InspectTab } from 'app/features/inspector/types';
import { getPanelLinksSupplier } from 'app/features/panel/panellinks/linkSuppliers';
import { isAngularDatasourcePlugin } from 'app/features/plugins/angularDeprecation/utils';
import { PanelHeaderTitleItems } from '../dashgrid/PanelHeader/PanelHeaderTitleItems';
export function getPanelChromeProps(props) {
    var _a, _b, _c, _d, _e;
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
    const onShowPanelLinks = () => {
        const linkSupplier = getPanelLinksSupplier(props.panel);
        if (!linkSupplier) {
            return [];
        }
        const panelLinks = linkSupplier && linkSupplier.getLinks(props.panel.replaceVariables);
        return panelLinks.map((panelLink) => (Object.assign(Object.assign({}, panelLink), { onClick: (...args) => {
                var _a;
                reportInteraction('dashboards_panelheader_datalink_clicked', { has_multiple_links: panelLinks.length > 1 });
                (_a = panelLink.onClick) === null || _a === void 0 ? void 0 : _a.call(panelLink, ...args);
            } })));
    };
    const onOpenInspector = (e, tab) => {
        e.stopPropagation();
        locationService.partial({ inspect: props.panel.id, inspectTab: tab });
    };
    const onOpenErrorInspect = (e) => {
        e.stopPropagation();
        locationService.partial({ inspect: props.panel.id, inspectTab: InspectTab.Error });
        reportInteraction('dashboards_panelheader_statusmessage_clicked');
    };
    const onCancelQuery = () => {
        props.panel.getQueryRunner().cancelQuery();
        reportInteraction('dashboards_panelheader_cancelquery_clicked', { data_state: props.data.state });
    };
    const padding = props.plugin.noPadding ? 'none' : 'md';
    const alertState = (_a = props.data.alertState) === null || _a === void 0 ? void 0 : _a.state;
    const isAngularDatasource = ((_b = props.panel.datasource) === null || _b === void 0 ? void 0 : _b.uid)
        ? isAngularDatasourcePlugin((_c = props.panel.datasource) === null || _c === void 0 ? void 0 : _c.uid)
        : false;
    const isAngularPanel = props.panel.isAngularPlugin();
    const showAngularNotice = ((_d = config.featureToggles.angularDeprecationUI) !== null && _d !== void 0 ? _d : false) && (isAngularDatasource || isAngularPanel);
    const showTitleItems = (props.panel.links && props.panel.links.length > 0 && onShowPanelLinks) ||
        (props.data.series.length > 0 && props.data.series.some((v) => { var _a, _b, _c; return ((_c = (_b = (_a = v.meta) === null || _a === void 0 ? void 0 : _a.notices) === null || _b === void 0 ? void 0 : _b.length) !== null && _c !== void 0 ? _c : 0) > 0; })) ||
        (props.data.request && props.data.request.timeInfo) ||
        showAngularNotice ||
        alertState;
    const titleItems = showTitleItems && (React.createElement(PanelHeaderTitleItems, { alertState: alertState, data: props.data, panelId: props.panel.id, panelLinks: props.panel.links, angularNotice: {
            show: showAngularNotice,
            isAngularDatasource,
            isAngularPanel,
        }, onShowPanelLinks: onShowPanelLinks }));
    const description = props.panel.description ? onShowPanelDescription : undefined;
    const dragClass = !(props.isViewing || props.isEditing) && Boolean((_e = props.isDraggable) !== null && _e !== void 0 ? _e : true) ? 'grid-drag-handle' : '';
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
//# sourceMappingURL=getPanelChromeProps.js.map