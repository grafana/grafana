import { config } from '../config';
// @ts-ignore
import System from 'systemjs/dist/system.js';
/**
 * @internal
 */
export var SystemJS = System;
/**
 * Use this to load css for a Grafana plugin by specifying a {@link PluginCssOptions}
 * containing styling for the dark and the light theme.
 *
 * @param options - plugin styling for light and dark theme.
 * @public
 */
export function loadPluginCss(options) {
    var theme = config.bootData.user.lightTheme ? options.light : options.dark;
    return SystemJS.import(theme + "!css");
}
//# sourceMappingURL=plugin.js.map