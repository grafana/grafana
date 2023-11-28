import { __rest } from "tslib";
import { isString } from 'lodash';
import { PluginExtensionTypes, urlUtil, } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { isPluginExtensionLinkConfig, getReadOnlyProxy, logWarning, generateExtensionId, getEventHelpers, isPluginExtensionComponentConfig, } from './utils';
import { assertIsReactComponent, assertIsNotPromise, assertLinkPathIsValid, assertStringProps, isPromise, } from './validators';
// Returns with a list of plugin extensions for the given extension point
export const getPluginExtensions = ({ context, extensionPointId, limitPerPlugin, registry }) => {
    var _a;
    const frozenContext = context ? getReadOnlyProxy(context) : {};
    const registryItems = (_a = registry[extensionPointId]) !== null && _a !== void 0 ? _a : [];
    // We don't return the extensions separated by type, because in that case it would be much harder to define a sort-order for them.
    const extensions = [];
    const extensionsByPlugin = {};
    for (const registryItem of registryItems) {
        try {
            const extensionConfig = registryItem.config;
            const { pluginId } = registryItem;
            // Only limit if the `limitPerPlugin` is set
            if (limitPerPlugin && extensionsByPlugin[pluginId] >= limitPerPlugin) {
                continue;
            }
            if (extensionsByPlugin[pluginId] === undefined) {
                extensionsByPlugin[pluginId] = 0;
            }
            // LINK
            if (isPluginExtensionLinkConfig(extensionConfig)) {
                // Run the configure() function with the current context, and apply the ovverides
                const overrides = getLinkExtensionOverrides(pluginId, extensionConfig, frozenContext);
                // configure() returned an `undefined` -> hide the extension
                if (extensionConfig.configure && overrides === undefined) {
                    continue;
                }
                const path = (overrides === null || overrides === void 0 ? void 0 : overrides.path) || extensionConfig.path;
                const extension = {
                    id: generateExtensionId(pluginId, extensionConfig),
                    type: PluginExtensionTypes.link,
                    pluginId: pluginId,
                    onClick: getLinkExtensionOnClick(pluginId, extensionConfig, frozenContext),
                    // Configurable properties
                    icon: (overrides === null || overrides === void 0 ? void 0 : overrides.icon) || extensionConfig.icon,
                    title: (overrides === null || overrides === void 0 ? void 0 : overrides.title) || extensionConfig.title,
                    description: (overrides === null || overrides === void 0 ? void 0 : overrides.description) || extensionConfig.description,
                    path: isString(path) ? getLinkExtensionPathWithTracking(pluginId, path, extensionConfig) : undefined,
                    category: (overrides === null || overrides === void 0 ? void 0 : overrides.category) || extensionConfig.category,
                };
                extensions.push(extension);
                extensionsByPlugin[pluginId] += 1;
            }
            // COMPONENT
            if (isPluginExtensionComponentConfig(extensionConfig)) {
                assertIsReactComponent(extensionConfig.component);
                const extension = {
                    id: generateExtensionId(registryItem.pluginId, extensionConfig),
                    type: PluginExtensionTypes.component,
                    pluginId: registryItem.pluginId,
                    title: extensionConfig.title,
                    description: extensionConfig.description,
                    component: extensionConfig.component,
                };
                extensions.push(extension);
                extensionsByPlugin[pluginId] += 1;
            }
        }
        catch (error) {
            if (error instanceof Error) {
                logWarning(error.message);
            }
        }
    }
    return { extensions };
};
function getLinkExtensionOverrides(pluginId, config, context) {
    var _a;
    try {
        const overrides = (_a = config.configure) === null || _a === void 0 ? void 0 : _a.call(config, context);
        // Hiding the extension
        if (overrides === undefined) {
            return undefined;
        }
        let { title = config.title, description = config.description, path = config.path, icon = config.icon, category = config.category } = overrides, rest = __rest(overrides, ["title", "description", "path", "icon", "category"]);
        assertIsNotPromise(overrides, `The configure() function for "${config.title}" returned a promise, skipping updates.`);
        path && assertLinkPathIsValid(pluginId, path);
        assertStringProps({ title, description }, ['title', 'description']);
        if (Object.keys(rest).length > 0) {
            logWarning(`Extension "${config.title}", is trying to override restricted properties: ${Object.keys(rest).join(', ')} which will be ignored.`);
        }
        return {
            title,
            description,
            path,
            icon,
            category,
        };
    }
    catch (error) {
        if (error instanceof Error) {
            logWarning(error.message);
        }
        // If there is an error, we hide the extension
        // (This seems to be safest option in case the extension is doing something wrong.)
        return undefined;
    }
}
function getLinkExtensionOnClick(pluginId, config, context) {
    const { onClick } = config;
    if (!onClick) {
        return;
    }
    return function onClickExtensionLink(event) {
        try {
            reportInteraction('ui_extension_link_clicked', {
                pluginId: pluginId,
                extensionPointId: config.extensionPointId,
                title: config.title,
                category: config.category,
            });
            const result = onClick(event, getEventHelpers(context));
            if (isPromise(result)) {
                result.catch((e) => {
                    if (e instanceof Error) {
                        logWarning(e.message);
                    }
                });
            }
        }
        catch (error) {
            if (error instanceof Error) {
                logWarning(error.message);
            }
        }
    };
}
function getLinkExtensionPathWithTracking(pluginId, path, config) {
    return urlUtil.appendQueryToUrl(path, urlUtil.toUrlParams({
        uel_pid: pluginId,
        uel_epid: config.extensionPointId,
    }));
}
//# sourceMappingURL=getPluginExtensions.js.map