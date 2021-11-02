import { __assign, __awaiter, __generator, __makeTemplateObject, __read, __rest } from "tslib";
import React, { useRef, useState, useLayoutEffect } from 'react';
import { Icon, ToolbarButton, Tooltip, useStyles2 } from '@grafana/ui';
import { sanitize, sanitizeUrl } from '@grafana/data/src/text/sanitize';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { getLinkSrv } from '../../../../angular/panel/panellinks/link_srv';
import { selectors } from '@grafana/e2e-selectors';
import { useAsync } from 'react-use';
import { css, cx } from '@emotion/css';
export var DashboardLinksDashboard = function (props) {
    var link = props.link, linkInfo = props.linkInfo;
    var listRef = useRef(null);
    var _a = __read(useState('invisible'), 2), dropdownCssClass = _a[0], setDropdownCssClass = _a[1];
    var _b = __read(useState(0), 2), opened = _b[0], setOpened = _b[1];
    var resolvedLinks = useResolvedLinks(props, opened);
    var buttonStyle = useStyles2(function (theme) {
        return css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n        color: ", ";\n      "], ["\n        color: ", ";\n      "])), theme.colors.text.primary);
    });
    useLayoutEffect(function () {
        setDropdownCssClass(getDropdownLocationCssClass(listRef.current));
    }, [resolvedLinks]);
    if (link.asDropdown) {
        return (React.createElement(LinkElement, { link: link, key: "dashlinks-dropdown", "data-testid": selectors.components.DashboardLinks.dropDown },
            React.createElement(React.Fragment, null,
                React.createElement(ToolbarButton, { onClick: function () { return setOpened(Date.now()); }, className: cx('gf-form-label gf-form-label--dashlink', buttonStyle), "data-placement": "bottom", "data-toggle": "dropdown", "aria-expanded": !!opened, "aria-controls": "dropdown-list", "aria-haspopup": "menu" },
                    React.createElement(Icon, { "aria-hidden": true, name: "bars", style: { marginRight: '4px' } }),
                    React.createElement("span", null, linkInfo.title)),
                React.createElement("ul", { id: "dropdown-list", className: "dropdown-menu " + dropdownCssClass, role: "menu", ref: listRef }, resolvedLinks.length > 0 &&
                    resolvedLinks.map(function (resolvedLink, index) {
                        return (React.createElement("li", { role: "none", key: "dashlinks-dropdown-item-" + resolvedLink.id + "-" + index },
                            React.createElement("a", { role: "menuitem", href: resolvedLink.url, target: link.targetBlank ? '_blank' : undefined, rel: "noreferrer", "data-testid": selectors.components.DashboardLinks.link, "aria-label": resolvedLink.title + " dashboard" }, resolvedLink.title)));
                    })))));
    }
    return (React.createElement(React.Fragment, null, resolvedLinks.length > 0 &&
        resolvedLinks.map(function (resolvedLink, index) {
            return (React.createElement(LinkElement, { link: link, key: "dashlinks-list-item-" + resolvedLink.id + "-" + index, "data-testid": selectors.components.DashboardLinks.container },
                React.createElement("a", { className: "gf-form-label gf-form-label--dashlink", href: resolvedLink.url, target: link.targetBlank ? '_blank' : undefined, rel: "noreferrer", "data-testid": selectors.components.DashboardLinks.link, "aria-label": resolvedLink.title + " dashboard" },
                    React.createElement(Icon, { "aria-hidden": true, name: "apps", style: { marginRight: '4px' } }),
                    React.createElement("span", null, resolvedLink.title))));
        })));
};
var LinkElement = function (props) {
    var link = props.link, children = props.children, rest = __rest(props, ["link", "children"]);
    return (React.createElement("div", __assign({}, rest, { className: "gf-form" }),
        link.tooltip && React.createElement(Tooltip, { content: link.tooltip }, children),
        !link.tooltip && React.createElement(React.Fragment, null, children)));
};
var useResolvedLinks = function (_a, opened) {
    var link = _a.link, dashboardId = _a.dashboardId;
    var tags = link.tags;
    var result = useAsync(function () { return searchForTags(tags); }, [tags, opened]);
    if (!result.value) {
        return [];
    }
    return resolveLinks(dashboardId, link, result.value);
};
export function searchForTags(tags, dependencies) {
    if (dependencies === void 0) { dependencies = { getBackendSrv: getBackendSrv }; }
    return __awaiter(this, void 0, void 0, function () {
        var limit, searchHits;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    limit = 100;
                    return [4 /*yield*/, dependencies.getBackendSrv().search({ tag: tags, limit: limit })];
                case 1:
                    searchHits = _a.sent();
                    return [2 /*return*/, searchHits];
            }
        });
    });
}
export function resolveLinks(dashboardId, link, searchHits, dependencies) {
    if (dependencies === void 0) { dependencies = {
        getLinkSrv: getLinkSrv,
        sanitize: sanitize,
        sanitizeUrl: sanitizeUrl,
    }; }
    return searchHits
        .filter(function (searchHit) { return searchHit.id !== dashboardId; })
        .map(function (searchHit) {
        var id = searchHit.id;
        var title = dependencies.sanitize(searchHit.title);
        var resolvedLink = dependencies.getLinkSrv().getLinkUrl(__assign(__assign({}, link), { url: searchHit.url }));
        var url = dependencies.sanitizeUrl(resolvedLink);
        return { id: id, title: title, url: url };
    });
}
function getDropdownLocationCssClass(element) {
    if (!element) {
        return 'invisible';
    }
    var wrapperPos = element.parentElement.getBoundingClientRect();
    var pos = element.getBoundingClientRect();
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
var templateObject_1;
//# sourceMappingURL=DashboardLinksDashboard.js.map