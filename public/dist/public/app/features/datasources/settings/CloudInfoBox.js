import { Alert } from '@grafana/ui';
import React from 'react';
import { config } from 'app/core/config';
import { GrafanaEdition } from '@grafana/data/src/types/config';
import { LocalStorageValueProvider } from 'app/core/components/LocalStorageValueProvider';
var LOCAL_STORAGE_KEY = 'datasources.settings.cloudInfoBox.isDismissed';
export var CloudInfoBox = function (_a) {
    var _b;
    var dataSource = _a.dataSource;
    var mainDS = '';
    var extraDS = '';
    // don't show for already configured data sources or provisioned data sources
    if (dataSource.readOnly || ((_b = dataSource.version) !== null && _b !== void 0 ? _b : 0) > 2) {
        return null;
    }
    // Skip showing this info box in some editions
    if (config.buildInfo.edition !== GrafanaEdition.OpenSource) {
        return null;
    }
    switch (dataSource.type) {
        case 'prometheus':
            mainDS = 'Prometheus';
            extraDS = 'Loki';
            break;
        case 'loki':
            mainDS = 'Loki';
            extraDS = 'Prometheus';
            break;
        default:
            return null;
    }
    return (React.createElement(LocalStorageValueProvider, { storageKey: LOCAL_STORAGE_KEY, defaultValue: false }, function (isDismissed, onDismiss) {
        if (isDismissed) {
            return null;
        }
        return (React.createElement(Alert, { title: "Configure your " + mainDS + " data source below", severity: "info", bottomSpacing: 4, onRemove: function () {
                onDismiss(true);
            } },
            "Or skip the effort and get ",
            mainDS,
            " (and ",
            extraDS,
            ") as fully-managed, scalable, and hosted data sources from Grafana Labs with the",
            ' ',
            React.createElement("a", { className: "external-link", href: "https://grafana.com/signup/cloud/connect-account?src=grafana-oss&cnt=" + dataSource.type + "-settings", target: "_blank", rel: "noreferrer", title: "The free plan includes 10k active metrics and 50gb storage." }, "free-forever Grafana Cloud plan"),
            "."));
    }));
};
//# sourceMappingURL=CloudInfoBox.js.map