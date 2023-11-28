import { __awaiter } from "tslib";
import { PluginType } from '@grafana/data';
import { importPanelPluginFromMeta } from './importPanelPlugin';
import { getPluginSettings } from './pluginSettings';
import { importAppPlugin, importDataSourcePlugin } from './plugin_loader';
export function loadPlugin(pluginId) {
    return __awaiter(this, void 0, void 0, function* () {
        const info = yield getPluginSettings(pluginId);
        let result;
        if (info.type === PluginType.app) {
            result = yield importAppPlugin(info);
        }
        if (info.type === PluginType.datasource) {
            result = yield importDataSourcePlugin(info);
        }
        if (info.type === PluginType.panel) {
            const panelPlugin = yield importPanelPluginFromMeta(info);
            result = panelPlugin;
        }
        if (info.type === PluginType.renderer) {
            result = { meta: info };
        }
        if (!result) {
            throw new Error('Unknown Plugin type: ' + info.type);
        }
        return result;
    });
}
export function buildPluginSectionNav(pluginNavSection, pluginNav, currentUrl) {
    var _a;
    // shallow clone as we set active flag
    const MAX_RECURSION_DEPTH = 10;
    let copiedPluginNavSection = Object.assign({}, pluginNavSection);
    let activePage;
    function setPageToActive(page, currentUrl) {
        var _a, _b, _c, _d, _e;
        if (!currentUrl.startsWith((_a = page.url) !== null && _a !== void 0 ? _a : '')) {
            return page;
        }
        // Check if there is already an active page found with with a more specific url (possibly a child of the current page)
        // (In this case we bail out early and don't mark the parent as active)
        if (activePage && ((_c = (_b = activePage.url) === null || _b === void 0 ? void 0 : _b.length) !== null && _c !== void 0 ? _c : 0) > ((_e = (_d = page.url) === null || _d === void 0 ? void 0 : _d.length) !== null && _e !== void 0 ? _e : 0)) {
            return page;
        }
        if (activePage) {
            activePage.active = false;
        }
        activePage = Object.assign(Object.assign({}, page), { active: true });
        return activePage;
    }
    function findAndSetActivePage(child, depth = 0) {
        if (depth > MAX_RECURSION_DEPTH) {
            return child;
        }
        if (child.children) {
            // Doing this here to make sure that first we check if any of the children is active
            // (In case yes, then the check for the parent will not mark it as active)
            const children = child.children.map((pluginPage) => findAndSetActivePage(pluginPage, depth + 1));
            return Object.assign(Object.assign({}, setPageToActive(child, currentUrl)), { children });
        }
        return setPageToActive(child, currentUrl);
    }
    // Find and set active page
    copiedPluginNavSection.children = ((_a = copiedPluginNavSection === null || copiedPluginNavSection === void 0 ? void 0 : copiedPluginNavSection.children) !== null && _a !== void 0 ? _a : []).map(findAndSetActivePage);
    return { main: copiedPluginNavSection, node: activePage !== null && activePage !== void 0 ? activePage : copiedPluginNavSection };
}
//# sourceMappingURL=utils.js.map