import { __awaiter, __rest } from "tslib";
import { css, cx } from '@emotion/css';
import React, { useRef, useState, useLayoutEffect } from 'react';
import { useAsync } from 'react-use';
import { sanitize, sanitizeUrl } from '@grafana/data/src/text/sanitize';
import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { Icon, ToolbarButton, Tooltip, useStyles2 } from '@grafana/ui';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { isPmmAdmin } from 'app/percona/shared/helpers/permissions';
import { getLinkSrv } from '../../../panel/panellinks/link_srv';
export const DashboardLinksDashboard = (props) => {
    const { link, linkInfo } = props;
    const listRef = useRef(null);
    const [dropdownCssClass, setDropdownCssClass] = useState('invisible');
    const [opened, setOpened] = useState(0);
    let resolvedLinks = useResolvedLinks(props, opened);
    const styles = useStyles2(getStyles);
    useLayoutEffect(() => {
        setDropdownCssClass(getDropdownLocationCssClass(listRef.current));
    }, [resolvedLinks]);
    // @PERCONA
    // TODO: PMM-7736 remove it ASAP after migration transition period is finished
    if (link.title === 'PMM') {
        if (isPmmAdmin(config.bootData.user)) {
            resolvedLinks = [
                { uid: '1000', url: '/graph/add-instance', title: 'PMM Add Instance' },
                { uid: '1001', url: '/graph/advisors/insights', title: 'PMM Advisors' },
                { uid: '1002', url: '/graph/inventory', title: 'PMM Inventory' },
                { uid: '1003', url: '/graph/settings', title: 'PMM Settings' },
            ];
        }
        else {
            return React.createElement(React.Fragment, null);
        }
    }
    if (link.asDropdown) {
        return (React.createElement(LinkElement, { link: link, key: "dashlinks-dropdown", "data-testid": selectors.components.DashboardLinks.dropDown },
            React.createElement(React.Fragment, null,
                React.createElement(ToolbarButton, { onClick: () => setOpened(Date.now()), className: cx('gf-form-label gf-form-label--dashlink', styles.button), "data-placement": "bottom", "data-toggle": "dropdown", "aria-expanded": !!opened, "aria-controls": "dropdown-list", "aria-haspopup": "menu" },
                    React.createElement(Icon, { "aria-hidden": true, name: "bars", className: styles.iconMargin }),
                    React.createElement("span", null, linkInfo.title)),
                React.createElement("ul", { id: "dropdown-list", className: `dropdown-menu ${styles.dropdown} ${dropdownCssClass}`, role: "menu", ref: listRef }, resolvedLinks.length > 0 &&
                    resolvedLinks.map((resolvedLink, index) => {
                        return (React.createElement("li", { role: "none", key: `dashlinks-dropdown-item-${resolvedLink.uid}-${index}` },
                            React.createElement("a", { role: "menuitem", href: resolvedLink.url, target: link.targetBlank ? '_blank' : undefined, rel: "noreferrer", "data-testid": selectors.components.DashboardLinks.link, "aria-label": `${resolvedLink.title} dashboard` }, resolvedLink.title)));
                    })))));
    }
    return (React.createElement(React.Fragment, null, resolvedLinks.length > 0 &&
        resolvedLinks.map((resolvedLink, index) => {
            return (React.createElement(LinkElement, { link: link, key: `dashlinks-list-item-${resolvedLink.uid}-${index}`, "data-testid": selectors.components.DashboardLinks.container },
                React.createElement("a", { className: "gf-form-label gf-form-label--dashlink", href: resolvedLink.url, target: link.targetBlank ? '_blank' : undefined, rel: "noreferrer", "data-testid": selectors.components.DashboardLinks.link, "aria-label": `${resolvedLink.title} dashboard` },
                    React.createElement(Icon, { "aria-hidden": true, name: "apps", style: { marginRight: '4px' } }),
                    React.createElement("span", null, resolvedLink.title))));
        })));
};
const LinkElement = (props) => {
    const { link, children } = props, rest = __rest(props, ["link", "children"]);
    return (React.createElement("div", Object.assign({}, rest, { className: "gf-form" }),
        link.tooltip && React.createElement(Tooltip, { content: link.tooltip }, children),
        !link.tooltip && React.createElement(React.Fragment, null, children)));
};
const useResolvedLinks = ({ link, dashboardUID }, opened) => {
    const { tags } = link;
    const result = useAsync(() => searchForTags(tags), [tags, opened]);
    if (!result.value) {
        return [];
    }
    return resolveLinks(dashboardUID, link, result.value);
};
export function searchForTags(tags, dependencies = { getBackendSrv }) {
    return __awaiter(this, void 0, void 0, function* () {
        const limit = 100;
        const searchHits = yield dependencies.getBackendSrv().search({ tag: tags, limit });
        return searchHits;
    });
}
export function resolveLinks(dashboardUID, link, searchHits, dependencies = {
    getLinkSrv,
    sanitize,
    sanitizeUrl,
}) {
    return searchHits
        .filter((searchHit) => searchHit.uid !== dashboardUID)
        .map((searchHit) => {
        const uid = searchHit.uid;
        const title = dependencies.sanitize(searchHit.title);
        const resolvedLink = dependencies.getLinkSrv().getLinkUrl(Object.assign(Object.assign({}, link), { url: searchHit.url }));
        const url = dependencies.sanitizeUrl(resolvedLink);
        return { uid, title, url };
    });
}
function getDropdownLocationCssClass(element) {
    if (!element) {
        return 'invisible';
    }
    const wrapperPos = element.parentElement.getBoundingClientRect();
    const pos = element.getBoundingClientRect();
    if (pos.width === 0) {
        return 'invisible';
    }
    if (wrapperPos.left + pos.width + 10 > window.innerWidth) {
        return 'pull-left';
    }
    else {
        return 'pull-right';
    }
}
function getStyles(theme) {
    return {
        iconMargin: css({
            marginRight: theme.spacing(0.5),
        }),
        dropdown: css({
            maxWidth: 'max(30vw, 300px)',
            maxHeight: '70vh',
            overflowY: 'auto',
            a: {
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
            },
        }),
        button: css({
            color: theme.colors.text.primary,
        }),
    };
}
//# sourceMappingURL=DashboardLinksDashboard.js.map