import React from 'react';
import { Icon, Tooltip, useForceUpdate } from '@grafana/ui';
import { sanitizeUrl } from '@grafana/data/src/text/sanitize';
import { DashboardLinksDashboard } from './DashboardLinksDashboard';
import { getLinkSrv } from '../../../../angular/panel/panellinks/link_srv';
import { linkIconMap } from '../LinksSettings/LinkSettingsEdit';
import { useEffectOnce } from 'react-use';
import { selectors } from '@grafana/e2e-selectors';
import { TimeRangeUpdatedEvent } from '@grafana/runtime';
export var DashboardLinks = function (_a) {
    var dashboard = _a.dashboard, links = _a.links;
    var forceUpdate = useForceUpdate();
    useEffectOnce(function () {
        var sub = dashboard.events.subscribe(TimeRangeUpdatedEvent, forceUpdate);
        return function () { return sub.unsubscribe(); };
    });
    if (!links.length) {
        return null;
    }
    return (React.createElement(React.Fragment, null, links.map(function (link, index) {
        var linkInfo = getLinkSrv().getAnchorInfo(link);
        var key = link.title + "-$" + index;
        if (link.type === 'dashboards') {
            return React.createElement(DashboardLinksDashboard, { key: key, link: link, linkInfo: linkInfo, dashboardId: dashboard.id });
        }
        var linkElement = (React.createElement("a", { className: "gf-form-label gf-form-label--dashlink", href: sanitizeUrl(linkInfo.href), target: link.targetBlank ? '_blank' : undefined, rel: "noreferrer", "data-testid": selectors.components.DashboardLinks.link },
            React.createElement(Icon, { "aria-hidden": true, name: linkIconMap[link.icon], style: { marginRight: '4px' } }),
            React.createElement("span", null, linkInfo.title)));
        return (React.createElement("div", { key: key, className: "gf-form", "data-testid": selectors.components.DashboardLinks.container }, link.tooltip ? React.createElement(Tooltip, { content: linkInfo.tooltip }, linkElement) : linkElement));
    })));
};
//# sourceMappingURL=DashboardLinks.js.map