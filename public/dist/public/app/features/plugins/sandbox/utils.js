import { isNearMembraneProxy } from '@locker/near-membrane-shared';
import React from 'react';
import { logWarning as logWarningRuntime, logError as logErrorRuntime, config } from '@grafana/runtime';
const monitorOnly = Boolean(config.featureToggles.frontendSandboxMonitorOnly);
export function isSandboxedPluginObject(value) {
    return !!value && typeof value === 'object' && (value === null || value === void 0 ? void 0 : value.hasOwnProperty('plugin'));
}
export function assertNever(x) {
    throw new Error(`Unexpected object: ${x}. This should never happen.`);
}
export function isReactClassComponent(obj) {
    return obj instanceof React.Component;
}
export function logWarning(message, context) {
    context = Object.assign(Object.assign({}, context), { source: 'sandbox', monitorOnly: String(monitorOnly) });
    logWarningRuntime(message, context);
}
export function logError(error, context) {
    context = Object.assign(Object.assign({}, context), { source: 'sandbox', monitorOnly: String(monitorOnly) });
    logErrorRuntime(error, context);
}
export function isFrontendSandboxSupported({ isAngular, pluginId, }) {
    // To fast test and debug the sandbox in the browser.
    const sandboxQueryParam = location.search.includes('nosandbox') && config.buildInfo.env === 'development';
    const isPluginExcepted = config.disableFrontendSandboxForPlugins.includes(pluginId);
    return (!isAngular &&
        Boolean(config.featureToggles.pluginsFrontendSandbox) &&
        process.env.NODE_ENV !== 'test' &&
        !isPluginExcepted &&
        !sandboxQueryParam);
}
function isRegex(value) {
    var _a;
    return ((_a = value === null || value === void 0 ? void 0 : value.constructor) === null || _a === void 0 ? void 0 : _a.name) === 'RegExp';
}
/**
 * Near membrane regex proxy objects behave just exactly the same as regular RegExp objects
 * with only one difference: they are not `instanceof RegExp`.
 * This function takes a structure and makes sure any regex that is a nearmembraneproxy
 * and returns the same regex but in the bluerealm
 */
export function unboxRegexesFromMembraneProxy(structure) {
    if (!structure) {
        return structure;
    }
    // Proxy regexes loook and behave like proxies but they
    // are not instanceof RegExp
    if (isRegex(structure) && isNearMembraneProxy(structure)) {
        return new RegExp(structure);
    }
    if (Array.isArray(structure)) {
        return structure.map(unboxRegexesFromMembraneProxy);
    }
    if (typeof structure === 'object') {
        return Object.keys(structure).reduce((acc, key) => {
            Reflect.set(acc, key, unboxRegexesFromMembraneProxy(Reflect.get(structure, key)));
            return acc;
        }, {});
    }
    return structure;
}
//# sourceMappingURL=utils.js.map