import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useMountedState } from 'react-use';
import { takeWhile } from 'rxjs/operators';
import { dateTimeFormatISO, LoadingState } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { Alert, Button, HorizontalGroup, useStyles2 } from '@grafana/ui';
import { previewAlertRule } from '../../api/preview';
import { useAlertQueriesStatus } from '../../hooks/useAlertQueriesStatus';
import { RuleFormType } from '../../types/rule-form';
import { PreviewRuleResult } from './PreviewRuleResult';
const fields = ['type', 'dataSourceName', 'condition', 'queries', 'expression'];
export function PreviewRule() {
    const styles = useStyles2(getStyles);
    const [preview, onPreview] = usePreview();
    const { watch } = useFormContext();
    const [type, condition, queries] = watch(['type', 'condition', 'queries']);
    const { allDataSourcesAvailable } = useAlertQueriesStatus(queries);
    if (type === RuleFormType.cloudRecording || type === RuleFormType.cloudAlerting) {
        return null;
    }
    const isPreviewAvailable = Boolean(condition) && allDataSourcesAvailable;
    return (React.createElement("div", { className: styles.container },
        React.createElement(HorizontalGroup, null,
            allDataSourcesAvailable && (React.createElement(Button, { disabled: !isPreviewAvailable, type: "button", variant: "primary", onClick: onPreview }, "Preview alerts")),
            !allDataSourcesAvailable && (React.createElement(Alert, { title: "Preview is not available", severity: "warning" }, "Cannot display the query preview. Some of the data sources used in the queries are not available."))),
        React.createElement(PreviewRuleResult, { preview: preview })));
}
export function usePreview() {
    const [preview, setPreview] = useState();
    const { getValues } = useFormContext();
    const isMounted = useMountedState();
    const onPreview = useCallback(() => {
        const values = getValues(fields);
        const request = createPreviewRequest(values);
        previewAlertRule(request)
            .pipe(takeWhile((response) => !isCompleted(response), true))
            .subscribe((response) => {
            if (!isMounted()) {
                return;
            }
            setPreview(response);
        });
    }, [getValues, isMounted]);
    return [preview, onPreview];
}
function createPreviewRequest(values) {
    const [type, dataSourceName, condition, queries, expression] = values;
    const dsSettings = getDataSourceSrv().getInstanceSettings(dataSourceName);
    if (!dsSettings) {
        throw new Error(`Cannot find data source settings for ${dataSourceName}`);
    }
    switch (type) {
        case RuleFormType.cloudAlerting:
            return {
                dataSourceUid: dsSettings.uid,
                dataSourceName,
                expr: expression,
            };
        case RuleFormType.grafana:
            return {
                grafana_condition: {
                    condition,
                    data: queries,
                    now: dateTimeFormatISO(Date.now()),
                },
            };
        default:
            throw new Error(`Alert type ${type} not supported by preview.`);
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
        container: css `
      margin-top: ${theme.spacing(2)};
      max-width: ${theme.breakpoints.values.xxl}px;
    `,
    };
}
//# sourceMappingURL=PreviewRule.js.map