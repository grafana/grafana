import React from 'react';
import { reportInteraction } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { LocalStorageValueProvider } from 'app/core/components/LocalStorageValueProvider';
const LOCAL_STORAGE_KEY_PREFIX = 'grafana.angularDeprecation.dashboardNotice.isDismissed';
function localStorageKey(dashboardUid) {
    return LOCAL_STORAGE_KEY_PREFIX + '.' + dashboardUid;
}
export function AngularDeprecationNotice({ dashboardUid }) {
    return (React.createElement(LocalStorageValueProvider, { storageKey: localStorageKey(dashboardUid), defaultValue: false }, (isDismissed, onDismiss) => {
        if (isDismissed) {
            return null;
        }
        return (React.createElement("div", null,
            React.createElement(Alert, { severity: "warning", title: "This dashboard depends on Angular, which is deprecated and will stop working in future releases of Grafana.", onRemove: () => {
                    reportInteraction('angular_deprecation_notice_dismissed');
                    onDismiss(true);
                } },
                React.createElement("div", { className: "markdown-html" },
                    React.createElement("ul", null,
                        React.createElement("li", null,
                            React.createElement("a", { href: "https://grafana.com/docs/grafana/latest/developers/angular_deprecation/", className: "external-link", target: "_blank", rel: "noreferrer" }, "Read our deprecation notice and migration advice.")))))));
    }));
}
//# sourceMappingURL=AngularDeprecationNotice.js.map