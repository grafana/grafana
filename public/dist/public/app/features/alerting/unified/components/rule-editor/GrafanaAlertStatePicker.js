import { __rest } from "tslib";
import React, { useMemo } from 'react';
import { Select } from '@grafana/ui';
import { GrafanaAlertStateDecision } from 'app/types/unified-alerting-dto';
const options = [
    { value: GrafanaAlertStateDecision.Alerting, label: 'Alerting' },
    { value: GrafanaAlertStateDecision.NoData, label: 'No Data' },
    { value: GrafanaAlertStateDecision.OK, label: 'OK' },
    { value: GrafanaAlertStateDecision.Error, label: 'Error' },
];
export const GrafanaAlertStatePicker = (_a) => {
    var { includeNoData, includeError } = _a, props = __rest(_a, ["includeNoData", "includeError"]);
    const opts = useMemo(() => {
        if (!includeNoData) {
            return options.filter((opt) => opt.value !== GrafanaAlertStateDecision.NoData);
        }
        if (!includeError) {
            return options.filter((opt) => opt.value !== GrafanaAlertStateDecision.Error);
        }
        return options;
    }, [includeNoData, includeError]);
    return React.createElement(Select, Object.assign({ options: opts }, props));
};
//# sourceMappingURL=GrafanaAlertStatePicker.js.map