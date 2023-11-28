import { isPluginExtensionLink } from '@grafana/runtime';
import { isPluginExtensionComponentConfig, isPluginExtensionLinkConfig, logWarning } from './utils';
export function assertPluginExtensionLink(extension, errorMessage = 'extension is not a link extension') {
    if (!isPluginExtensionLink(extension)) {
        throw new Error(errorMessage);
    }
}
export function assertPluginExtensionLinkConfig(extension, errorMessage = 'extension is not a command extension config') {
    if (!isPluginExtensionLinkConfig(extension)) {
        throw new Error(errorMessage);
    }
}
export function assertLinkPathIsValid(pluginId, path) {
    if (!isLinkPathValid(pluginId, path)) {
        throw new Error(`Invalid link extension. The "path" is required and should start with "/a/${pluginId}/" (currently: "${path}"). Skipping the extension.`);
    }
}
export function assertIsReactComponent(component) {
    if (!isReactComponent(component)) {
        throw new Error(`Invalid component extension, the "component" property needs to be a valid React component.`);
    }
}
export function assertExtensionPointIdIsValid(extension) {
    if (!isExtensionPointIdValid(extension)) {
        throw new Error(`Invalid extension "${extension.title}". The extensionPointId should start with either "grafana/" or "plugins/" (currently: "${extension.extensionPointId}"). Skipping the extension.`);
    }
}
export function assertConfigureIsValid(extension) {
    if (!isConfigureFnValid(extension)) {
        throw new Error(`Invalid extension "${extension.title}". The "configure" property must be a function. Skipping the extension.`);
    }
}
export function assertStringProps(extension, props) {
    for (const prop of props) {
        if (!isStringPropValid(extension[prop])) {
            throw new Error(`Invalid extension "${extension.title}". Property "${prop}" must be a string and cannot be empty. Skipping the extension.`);
        }
    }
}
export function assertIsNotPromise(value, errorMessage = 'The provided value is a Promise.') {
    if (isPromise(value)) {
        throw new Error(errorMessage);
    }
}
export function isLinkPathValid(pluginId, path) {
    return Boolean(typeof path === 'string' && path.length > 0 && path.startsWith(`/a/${pluginId}/`));
}
export function isExtensionPointIdValid(extension) {
    var _a, _b;
    return Boolean(((_a = extension.extensionPointId) === null || _a === void 0 ? void 0 : _a.startsWith('grafana/')) || ((_b = extension.extensionPointId) === null || _b === void 0 ? void 0 : _b.startsWith('plugins/')));
}
export function isConfigureFnValid(extension) {
    return extension.configure ? typeof extension.configure === 'function' : true;
}
export function isStringPropValid(prop) {
    return typeof prop === 'string' && prop.length > 0;
}
export function isPluginExtensionConfigValid(pluginId, extension) {
    try {
        assertStringProps(extension, ['title', 'description', 'extensionPointId']);
        assertExtensionPointIdIsValid(extension);
        if (isPluginExtensionLinkConfig(extension)) {
            assertConfigureIsValid(extension);
            if (!extension.path && !extension.onClick) {
                logWarning(`Invalid extension "${extension.title}". Either "path" or "onClick" is required.`);
                return false;
            }
            if (extension.path) {
                assertLinkPathIsValid(pluginId, extension.path);
            }
        }
        if (isPluginExtensionComponentConfig(extension)) {
            assertIsReactComponent(extension.component);
        }
        return true;
    }
    catch (error) {
        if (error instanceof Error) {
            logWarning(error.message);
        }
        return false;
    }
}
export function isPromise(value) {
    return (value instanceof Promise || (typeof value === 'object' && value !== null && 'then' in value && 'catch' in value));
}
export function isReactComponent(component) {
    const hasReactTypeProp = (obj) => typeof obj === 'object' && obj !== null && '$$typeof' in obj;
    // The sandbox wraps the plugin components with React.memo.
    const isReactMemoObject = (obj) => hasReactTypeProp(obj) && obj.$$typeof === Symbol.for('react.memo');
    // We currently don't have any strict runtime-checking for this.
    // (The main reason is that we don't want to start depending on React implementation details.)
    return typeof component === 'function' || isReactMemoObject(component);
}
//# sourceMappingURL=validators.js.map