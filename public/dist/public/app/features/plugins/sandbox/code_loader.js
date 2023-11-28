import { __awaiter } from "tslib";
import { patchArrayVectorProrotypeMethods } from '@grafana/data';
import { transformPluginSourceForCDN } from '../cdn/utils';
import { resolveWithCache } from '../loader/cache';
import { isHostedOnCDN } from '../loader/utils';
function isSameDomainAsHost(url) {
    const locationUrl = new URL(window.location.href);
    const paramUrl = new URL(url);
    return locationUrl.host === paramUrl.host;
}
export function loadScriptIntoSandbox(url, meta, sandboxEnv) {
    return __awaiter(this, void 0, void 0, function* () {
        let scriptCode = '';
        // same-domain
        if (isSameDomainAsHost(url)) {
            const response = yield fetch(url);
            scriptCode = yield response.text();
            //even though this is not loaded via a CDN we need to transform the sourceMapUrl
            scriptCode = transformPluginSourceForCDN({
                url,
                source: scriptCode,
                transformSourceMapURL: true,
                transformAssets: false,
            });
            // cdn loaded
        }
        else if (isHostedOnCDN(url)) {
            const response = yield fetch(url);
            scriptCode = yield response.text();
            scriptCode = transformPluginSourceForCDN({
                url,
                source: scriptCode,
                transformSourceMapURL: true,
                transformAssets: true,
            });
        }
        if (scriptCode.length === 0) {
            throw new Error('Only same domain scripts are allowed in sandboxed plugins');
        }
        scriptCode = patchPluginAPIs(scriptCode);
        sandboxEnv.evaluate(scriptCode);
    });
}
export function getPluginCode(meta) {
    return __awaiter(this, void 0, void 0, function* () {
        if (isHostedOnCDN(meta.module)) {
            // Load plugin from CDN, no need for "resolveWithCache" as CDN URLs already include the version
            const url = meta.module;
            const response = yield fetch(url);
            let pluginCode = yield response.text();
            pluginCode = transformPluginSourceForCDN({
                url,
                source: pluginCode,
                transformSourceMapURL: true,
                transformAssets: true,
            });
            return pluginCode;
        }
        else {
            // local plugin. resolveWithCache will append a query parameter with its version
            // to ensure correct cached version is served
            const pluginCodeUrl = resolveWithCache(meta.module);
            const response = yield fetch(pluginCodeUrl);
            let pluginCode = yield response.text();
            pluginCode = transformPluginSourceForCDN({
                url: pluginCodeUrl,
                source: pluginCode,
                transformSourceMapURL: true,
                transformAssets: false,
            });
            pluginCode = patchPluginAPIs(pluginCode);
            return pluginCode;
        }
    });
}
function patchPluginAPIs(pluginCode) {
    return pluginCode.replace(/window\.location/gi, 'window.locationSandbox');
}
export function patchSandboxEnvironmentPrototype(sandboxEnvironment) {
    // same as https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/types/vector.ts#L16
    // Array is a "reflective" type in Near-membrane and doesn't get an identify continuity
    sandboxEnvironment.evaluate(`${patchArrayVectorProrotypeMethods.toString()};${patchArrayVectorProrotypeMethods.name}()`);
}
//# sourceMappingURL=code_loader.js.map