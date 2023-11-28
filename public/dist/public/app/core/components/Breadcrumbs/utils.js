import { config } from '@grafana/runtime';
export function buildBreadcrumbs(sectionNav, pageNav, homeNav) {
    const crumbs = [];
    let foundHome = false;
    let lastPath = undefined;
    function addCrumbs(node) {
        var _a, _b, _c, _d;
        if (foundHome) {
            return;
        }
        // construct the URL to match
        const urlParts = (_b = (_a = node.url) === null || _a === void 0 ? void 0 : _a.split('?')) !== null && _b !== void 0 ? _b : ['', ''];
        let urlToMatch = urlParts[0];
        if (config.featureToggles.dockedMegaMenu) {
            const urlSearchParams = new URLSearchParams(urlParts[1]);
            if (urlSearchParams.has('editview')) {
                urlToMatch += `?editview=${urlSearchParams.get('editview')}`;
            }
        }
        // Check if we found home/root if if so return early
        if (homeNav && urlToMatch === homeNav.url) {
            crumbs.unshift({ text: homeNav.text, href: (_c = node.url) !== null && _c !== void 0 ? _c : '' });
            foundHome = true;
            return;
        }
        // This enabled app plugins to control breadcrumbs of their root pages
        const isSamePathAsLastBreadcrumb = urlToMatch.length > 0 && lastPath === urlToMatch;
        // Remember this path for the next breadcrumb
        lastPath = urlToMatch;
        if (!node.hideFromBreadcrumbs && !isSamePathAsLastBreadcrumb) {
            crumbs.unshift({ text: node.text, href: (_d = node.url) !== null && _d !== void 0 ? _d : '' });
        }
        if (node.parentItem) {
            addCrumbs(node.parentItem);
        }
    }
    if (pageNav) {
        addCrumbs(pageNav);
    }
    addCrumbs(sectionNav);
    return crumbs;
}
//# sourceMappingURL=utils.js.map