import { __assign, __rest } from "tslib";
import { Select } from '@grafana/ui';
import { GrafanaAlertStateDecision } from 'app/types/unified-alerting-dto';
import React, { useMemo } from 'react';
var options = [
    { value: GrafanaAlertStateDecision.Alerting, label: 'Alerting' },
    { value: GrafanaAlertStateDecision.NoData, label: 'No Data' },
    { value: GrafanaAlertStateDecision.OK, label: 'OK' },
];
export var GrafanaAlertStatePicker = function (_a) {
    var includeNoData = _a.includeNoData, props = __rest(_a, ["includeNoData"]);
    var opts = useMemo(function () {
        if (includeNoData) {
            return options;
        }
        return options.filter(function (opt) { return opt.value !== GrafanaAlertStateDecision.NoData; });
    }, [includeNoData]);
    return React.createElement(Select, __assign({ menuShouldPortal: true, options: opts }, props));
};
//# sourceMappingURL=GrafanaAlertStatePicker.js.map