import React from 'react';
import { config } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
const EvaluationIntervalLimitExceeded = () => (React.createElement(Alert, { severity: "warning", title: "Global evalutation interval limit exceeded" },
    "A minimum evaluation interval of ",
    React.createElement("strong", null, config.unifiedAlerting.minInterval),
    " has been configured in Grafana.",
    React.createElement("br", null),
    "Please contact the administrator to configure a lower interval."));
export { EvaluationIntervalLimitExceeded };
//# sourceMappingURL=InvalidIntervalWarning.js.map