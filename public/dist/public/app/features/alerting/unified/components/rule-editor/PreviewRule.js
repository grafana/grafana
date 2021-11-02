import { __makeTemplateObject, __read } from "tslib";
import React, { useCallback, useState } from 'react';
import { css } from '@emotion/css';
import { useFormContext } from 'react-hook-form';
import { takeWhile } from 'rxjs/operators';
import { useMountedState } from 'react-use';
import { Button, HorizontalGroup, useStyles2 } from '@grafana/ui';
import { dateTimeFormatISO, LoadingState } from '@grafana/data';
import { RuleFormType } from '../../types/rule-form';
import { previewAlertRule } from '../../api/preview';
import { PreviewRuleResult } from './PreviewRuleResult';
var fields = ['type', 'dataSourceName', 'condition', 'queries', 'expression'];
export function PreviewRule() {
    var styles = useStyles2(getStyles);
    var _a = __read(usePreview(), 2), preview = _a[0], onPreview = _a[1];
    var watch = useFormContext().watch;
    var _b = __read(watch(['type', 'condition']), 2), type = _b[0], condition = _b[1];
    if (type === RuleFormType.cloudRecording || type === RuleFormType.cloudAlerting) {
        return null;
    }
    return (React.createElement("div", { className: styles.container },
        React.createElement(HorizontalGroup, null,
            React.createElement(Button, { disabled: !condition, type: "button", variant: "primary", onClick: onPreview }, "Preview alerts")),
        React.createElement(PreviewRuleResult, { preview: preview })));
}
function usePreview() {
    var _a = __read(useState(), 2), preview = _a[0], setPreview = _a[1];
    var getValues = useFormContext().getValues;
    var isMounted = useMountedState();
    var onPreview = useCallback(function () {
        var values = getValues(fields);
        var request = createPreviewRequest(values);
        previewAlertRule(request)
            .pipe(takeWhile(function (response) { return !isCompleted(response); }, true))
            .subscribe(function (response) {
            if (!isMounted()) {
                return;
            }
            setPreview(response);
        });
    }, [getValues, isMounted]);
    return [preview, onPreview];
}
function createPreviewRequest(values) {
    var _a = __read(values, 5), type = _a[0], dataSourceName = _a[1], condition = _a[2], queries = _a[3], expression = _a[4];
    switch (type) {
        case RuleFormType.cloudAlerting:
            return {
                dataSourceName: dataSourceName,
                expr: expression,
            };
        case RuleFormType.grafana:
            return {
                grafana_condition: {
                    condition: condition,
                    data: queries,
                    now: dateTimeFormatISO(Date.now()),
                },
            };
        default:
            throw new Error("Alert type " + type + " not supported by preview.");
    }
}
function isCompleted(response) {
    switch (response.data.state) {
        case LoadingState.Done:
        case LoadingState.Error:
            return true;
        default:
            return false;
    }
}
function getStyles(theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-top: ", ";\n    "], ["\n      margin-top: ", ";\n    "])), theme.spacing(2)),
    };
}
var templateObject_1;
//# sourceMappingURL=PreviewRule.js.map