import React from 'react';
import { useEffectOnce } from 'react-use';
import { sanitizeUrl } from '@grafana/data/src/text/sanitize';
import { selectors } from '@grafana/e2e-selectors';
import { TimeRangeUpdatedEvent } from '@grafana/runtime';
import { Icon, Tooltip, useForceUpdate } from '@grafana/ui';
import { getLinkSrv } from '../../../panel/panellinks/link_srv';
import { linkIconMap } from '../LinksSettings/LinkSettingsEdit';
import { DashboardLinksDashboard } from './DashboardLinksDashboard';
export const DashboardLinks = ({ dashboard, links }) => {
    const forceUpdate = useForceUpdate();
    useEffectOnce(() => {
        const sub = dashboard.events.subscribe(TimeRangeUpdatedEvent, forceUpdate);
        return () => sub.unsubscribe();
    });
    if (!links.length) {
        return null;
    }
    return (React.createElement(React.Fragment, null, links.map((link, index) => {
        const linkInfo = getLinkSrv().getAnchorInfo(link);
        const key = `${link.title}-$${index}`;
        if (link.type === 'dashboards') {
            return React.createElement(DashboardLinksDashboard, { key: key, link: link, linkInfo: linkInfo, dashboardUID: dashboard.uid });
        }
        const icon = linkIconMap[link.icon];
        const linkElement = (React.createElement("a", { className: "gf-form-label gf-form-label--dashlink", href: sanitizeUrl(linkInfo.href), target: link.targetBlank ? '_blank' : undefined, rel: "noreferrer", "data-testid": selectors.components.DashboardLinks.link },
            icon && React.createElement(Icon, { "aria-hidden": true, name: icon, style: { marginRight: '4px' } }),
            React.createElement("span", null, linkInfo.title)));
        return (React.createElement("div", { key: key, className: "gf-form", "data-testid": selectors.components.DashboardLinks.container }, link.tooltip ? React.createElement(Tooltip, { content: linkInfo.tooltip }, linkElement) : linkElement));
    })));
};
//# sourceMappingURL=DashboardLinks.js.map