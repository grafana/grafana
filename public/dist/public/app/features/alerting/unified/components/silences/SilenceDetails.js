import { __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
import { dateMath, intervalToAbbreviatedDurationString } from '@grafana/data';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import SilencedAlertsTable from './SilencedAlertsTable';
export var SilenceDetails = function (_a) {
    var silence = _a.silence;
    var startsAt = silence.startsAt, endsAt = silence.endsAt, comment = silence.comment, createdBy = silence.createdBy, silencedAlerts = silence.silencedAlerts;
    var styles = useStyles2(getStyles);
    var dateDisplayFormat = 'YYYY-MM-DD HH:mm';
    var startsAtDate = dateMath.parse(startsAt);
    var endsAtDate = dateMath.parse(endsAt);
    var duration = intervalToAbbreviatedDurationString({ start: new Date(startsAt), end: new Date(endsAt) });
    return (React.createElement("div", { className: styles.container },
        React.createElement("div", { className: styles.title }, "Comment"),
        React.createElement("div", null, comment),
        React.createElement("div", { className: styles.title }, "Schedule"),
        React.createElement("div", null, (startsAtDate === null || startsAtDate === void 0 ? void 0 : startsAtDate.format(dateDisplayFormat)) + " - " + (endsAtDate === null || endsAtDate === void 0 ? void 0 : endsAtDate.format(dateDisplayFormat))),
        React.createElement("div", { className: styles.title }, "Duration"),
        React.createElement("div", null,
            " ",
            duration),
        React.createElement("div", { className: styles.title }, "Created by"),
        React.createElement("div", null,
            " ",
            createdBy),
        React.createElement("div", { className: styles.title }, "Affected alerts"),
        React.createElement(SilencedAlertsTable, { silencedAlerts: silencedAlerts })));
};
var getStyles = function (theme) { return ({
    container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    display: grid;\n    grid-template-columns: 1fr 9fr;\n    grid-row-gap: 1rem;\n  "], ["\n    display: grid;\n    grid-template-columns: 1fr 9fr;\n    grid-row-gap: 1rem;\n  "]))),
    title: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.colors.text.primary),
    row: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin: ", ";\n  "], ["\n    margin: ", ";\n  "])), theme.spacing(1, 0)),
}); };
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=SilenceDetails.js.map