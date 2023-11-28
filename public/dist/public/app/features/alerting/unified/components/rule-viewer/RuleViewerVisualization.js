import { __rest } from "tslib";
import { css } from '@emotion/css';
import React, { useCallback } from 'react';
import { dateTime, urlUtil, } from '@grafana/data';
import { config } from '@grafana/runtime';
import { DateTimePicker, LinkButton, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { VizWrapper } from '../rule-editor/VizWrapper';
const headerHeight = 4;
export function RuleViewerVisualization({ data, model, thresholds, dsSettings, relativeTimeRange, onTimeRangeChange, className, }) {
    const styles = useStyles2(getStyles);
    const isExpression = isExpressionQuery(model);
    const onTimeChange = useCallback((newDateTime) => {
        const now = dateTime().unix() - newDateTime.unix();
        if (relativeTimeRange) {
            const interval = relativeTimeRange.from - relativeTimeRange.to;
            onTimeRangeChange({ from: now + interval, to: now });
        }
    }, [onTimeRangeChange, relativeTimeRange]);
    const setDateTime = useCallback((relativeTimeRangeTo) => {
        return relativeTimeRangeTo === 0 ? dateTime() : dateTime().subtract(relativeTimeRangeTo, 'seconds');
    }, []);
    if (!data) {
        return null;
    }
    const allowedToExploreDataSources = contextSrv.hasAccessToExplore();
    return (React.createElement("div", { className: className },
        React.createElement("div", { className: styles.header },
            React.createElement("div", { className: styles.actions },
                !isExpression && relativeTimeRange ? (React.createElement(DateTimePicker, { date: setDateTime(relativeTimeRange.to), onChange: onTimeChange, maxDate: new Date() })) : null,
                allowedToExploreDataSources && !isExpression && (React.createElement(LinkButton, { size: "md", variant: "secondary", icon: "compass", target: "_blank", href: createExploreLink(dsSettings, model) }, "View in Explore")))),
        React.createElement(VizWrapper, { data: data, thresholds: thresholds === null || thresholds === void 0 ? void 0 : thresholds.config, thresholdsType: thresholds === null || thresholds === void 0 ? void 0 : thresholds.mode })));
}
function createExploreLink(settings, model) {
    const { uid, type } = settings;
    const { refId } = model, rest = __rest(model, ["refId"]);
    /*
      In my testing I've found some alerts that don't have a data source embedded inside the model.
      At this moment in time it is unclear to me why some alert definitions not have a data source embedded in the model.
  
      I don't think that should happen here, the fact that the datasource ref is sometimes missing here is a symptom of another cause. (Gilles)
     */
    return urlUtil.renderUrl(`${config.appSubUrl}/explore`, {
        left: JSON.stringify({
            datasource: settings.uid,
            queries: [Object.assign(Object.assign({ refId: 'A' }, rest), { datasource: { type, uid } })],
            range: { from: 'now-1h', to: 'now' },
        }),
    });
}
const getStyles = (theme) => {
    return {
        header: css `
      height: ${theme.spacing(headerHeight)};
      display: flex;
      align-items: center;
      justify-content: flex-end;
      white-space: nowrap;
      margin-bottom: ${theme.spacing(2)};
    `,
        refId: css `
      font-weight: ${theme.typography.fontWeightMedium};
      color: ${theme.colors.text.link};
      overflow: hidden;
    `,
        dataSource: css `
      margin-left: ${theme.spacing(1)};
      font-style: italic;
      color: ${theme.colors.text.secondary};
    `,
        actions: css `
      display: flex;
      align-items: center;
    `,
        errorMessage: css `
      white-space: pre-wrap;
    `,
    };
};
//# sourceMappingURL=RuleViewerVisualization.js.map