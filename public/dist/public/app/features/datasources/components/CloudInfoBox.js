import React from 'react';
import { GrafanaEdition } from '@grafana/data/src/types/config';
import { Alert } from '@grafana/ui';
import { LocalStorageValueProvider } from 'app/core/components/LocalStorageValueProvider';
import { config } from 'app/core/config';
const LOCAL_STORAGE_KEY = 'datasources.settings.cloudInfoBox.isDismissed';
export function CloudInfoBox({ dataSource }) {
    var _a;
    let mainDS = '';
    let extraDS = '';
    // don't show for already configured data sources or provisioned data sources
    if (dataSource.readOnly || ((_a = dataSource.version) !== null && _a !== void 0 ? _a : 0) > 2) {
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
    return (React.createElement(LocalStorageValueProvider, { storageKey: LOCAL_STORAGE_KEY, defaultValue: false }, (isDismissed, onDismiss) => {
        if (isDismissed) {
            return null;
        }
        return (React.createElement(Alert, { title: `Configure your ${mainDS} data source below`, severity: "info", bottomSpacing: 4, onRemove: () => {
                onDismiss(true);
            } },
            "Or skip the effort and get ",
            mainDS,
            " (and ",
            extraDS,
            ") as fully-managed, scalable, and hosted data sources from Grafana Labs with the",
            ' ',
            React.createElement("a", { className: "external-link", href: `https://grafana.com/signup/cloud/connect-account?src=grafana-oss&cnt=${dataSource.type}-settings`, target: "_blank", rel: "noreferrer", title: "The free plan includes 10k active metrics and 50gb storage." }, "free-forever Grafana Cloud plan"),
            "."));
    }));
}
//# sourceMappingURL=CloudInfoBox.js.map