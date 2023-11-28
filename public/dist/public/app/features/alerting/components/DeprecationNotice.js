import React from 'react';
import { Alert } from '@grafana/ui';
export const LOCAL_STORAGE_KEY = 'grafana.legacyalerting.unifiedalertingpromo';
const DeprecationNotice = () => (React.createElement(Alert, { severity: "warning", title: "Grafana legacy alerting is deprecated and will be removed in a future release." },
    React.createElement("p", null,
        "You are using Grafana legacy alerting, which has been deprecated since Grafana 9.0. The codebase is now staying as is and will be removed in Grafana 11.0.",
        React.createElement("br", null),
        "We recommend upgrading to Grafana Alerting as soon as possible."),
    React.createElement("p", null,
        "See",
        ' ',
        React.createElement("a", { href: "https://grafana.com/docs/grafana/latest/alerting/migrating-alerts/" }, "how to upgrade to Grafana Alerting"),
        ' ',
        "to learn more.")));
export { DeprecationNotice };
//# sourceMappingURL=DeprecationNotice.js.map