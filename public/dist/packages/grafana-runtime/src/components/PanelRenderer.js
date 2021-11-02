import React from 'react';
/**
 * PanelRenderer component that will be set via the {@link setPanelRenderer} function
 * when Grafana starts. The implementation being used during runtime lives in Grafana
 * core.
 *
 * @internal
 */
export var PanelRenderer = function () {
    return React.createElement("div", null, "PanelRenderer can only be used after Grafana instance has been started.");
};
/**
 * Used to bootstrap the PanelRenderer during application start so the PanelRenderer
 * is exposed via runtime.
 *
 * @internal
 */
export function setPanelRenderer(renderer) {
    PanelRenderer = renderer;
}
//# sourceMappingURL=PanelRenderer.js.map