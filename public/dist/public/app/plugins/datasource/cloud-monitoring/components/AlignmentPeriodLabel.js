import React, { useMemo } from 'react';
import { rangeUtil } from '@grafana/data';
import { ALIGNMENTS } from '../constants';
export var AlignmentPeriodLabel = function (_a) {
    var customMetaData = _a.customMetaData, datasource = _a.datasource;
    var perSeriesAligner = customMetaData.perSeriesAligner, alignmentPeriod = customMetaData.alignmentPeriod;
    var formatAlignmentText = useMemo(function () {
        var _a;
        if (!alignmentPeriod || !perSeriesAligner) {
            return '';
        }
        var alignment = ALIGNMENTS.find(function (ap) { return ap.value === datasource.templateSrv.replace(perSeriesAligner); });
        var seconds = parseInt(alignmentPeriod !== null && alignmentPeriod !== void 0 ? alignmentPeriod : ''.replace(/[^0-9]/g, ''), 10);
        var hms = rangeUtil.secondsToHms(seconds);
        return hms + " interval (" + ((_a = alignment === null || alignment === void 0 ? void 0 : alignment.text) !== null && _a !== void 0 ? _a : '') + ")";
    }, [datasource, perSeriesAligner, alignmentPeriod]);
    return React.createElement("label", null, formatAlignmentText);
};
//# sourceMappingURL=AlignmentPeriodLabel.js.map