import { __makeTemplateObject, __read } from "tslib";
import React, { Fragment, useState } from 'react';
import { dateMath, intervalToAbbreviatedDurationString } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { CollapseToggle } from '../CollapseToggle';
import { ActionButton } from '../rules/ActionButton';
import { ActionIcon } from '../rules/ActionIcon';
import { useStyles, Link } from '@grafana/ui';
import SilencedAlertsTable from './SilencedAlertsTable';
import { expireSilenceAction } from '../../state/actions';
import { useDispatch } from 'react-redux';
import { Matchers } from './Matchers';
import { SilenceStateTag } from './SilenceStateTag';
import { makeAMLink } from '../../utils/misc';
import { contextSrv } from 'app/core/services/context_srv';
var SilenceTableRow = function (_a) {
    var silence = _a.silence, className = _a.className, silencedAlerts = _a.silencedAlerts, alertManagerSourceName = _a.alertManagerSourceName;
    var _b = __read(useState(true), 2), isCollapsed = _b[0], setIsCollapsed = _b[1];
    var dispatch = useDispatch();
    var styles = useStyles(getStyles);
    var status = silence.status, _c = silence.matchers, matchers = _c === void 0 ? [] : _c, startsAt = silence.startsAt, endsAt = silence.endsAt, comment = silence.comment, createdBy = silence.createdBy;
    var dateDisplayFormat = 'YYYY-MM-DD HH:mm';
    var startsAtDate = dateMath.parse(startsAt);
    var endsAtDate = dateMath.parse(endsAt);
    var duration = intervalToAbbreviatedDurationString({ start: new Date(startsAt), end: new Date(endsAt) });
    var handleExpireSilenceClick = function () {
        dispatch(expireSilenceAction(alertManagerSourceName, silence.id));
    };
    var detailsColspan = contextSrv.isEditor ? 4 : 3;
    return (React.createElement(Fragment, null,
        React.createElement("tr", { className: className, "data-testid": "silence-table-row" },
            React.createElement("td", null,
                React.createElement(CollapseToggle, { isCollapsed: isCollapsed, onToggle: function (value) { return setIsCollapsed(value); } })),
            React.createElement("td", null,
                React.createElement(SilenceStateTag, { state: status.state })),
            React.createElement("td", { className: styles.matchersCell },
                React.createElement(Matchers, { matchers: matchers })),
            React.createElement("td", { "data-testid": "silenced-alerts" }, silencedAlerts.length),
            React.createElement("td", null, startsAtDate === null || startsAtDate === void 0 ? void 0 :
                startsAtDate.format(dateDisplayFormat),
                " ",
                '-',
                React.createElement("br", null), endsAtDate === null || endsAtDate === void 0 ? void 0 :
                endsAtDate.format(dateDisplayFormat)),
            contextSrv.isEditor && (React.createElement("td", { className: styles.actionsCell },
                status.state === 'expired' ? (React.createElement(Link, { href: makeAMLink("/alerting/silence/" + silence.id + "/edit", alertManagerSourceName) },
                    React.createElement(ActionButton, { icon: "sync" }, "Recreate"))) : (React.createElement(ActionButton, { icon: "bell", onClick: handleExpireSilenceClick }, "Unsilence")),
                status.state !== 'expired' && (React.createElement(ActionIcon, { to: makeAMLink("/alerting/silence/" + silence.id + "/edit", alertManagerSourceName), icon: "pen", tooltip: "edit" }))))),
        !isCollapsed && (React.createElement(React.Fragment, null,
            React.createElement("tr", { className: className },
                React.createElement("td", null),
                React.createElement("td", null, "Comment"),
                React.createElement("td", { colSpan: detailsColspan }, comment)),
            React.createElement("tr", { className: className },
                React.createElement("td", null),
                React.createElement("td", null, "Schedule"),
                React.createElement("td", { colSpan: detailsColspan }, (startsAtDate === null || startsAtDate === void 0 ? void 0 : startsAtDate.format(dateDisplayFormat)) + " - " + (endsAtDate === null || endsAtDate === void 0 ? void 0 : endsAtDate.format(dateDisplayFormat)))),
            React.createElement("tr", { className: className },
                React.createElement("td", null),
                React.createElement("td", null, "Duration"),
                React.createElement("td", { colSpan: detailsColspan }, duration)),
            React.createElement("tr", { className: className },
                React.createElement("td", null),
                React.createElement("td", null, "Created by"),
                React.createElement("td", { colSpan: detailsColspan }, createdBy)),
            !!silencedAlerts.length && (React.createElement("tr", { className: cx(className, styles.alertRulesCell) },
                React.createElement("td", null),
                React.createElement("td", null, "Affected alerts"),
                React.createElement("td", { colSpan: detailsColspan },
                    React.createElement(SilencedAlertsTable, { silencedAlerts: silencedAlerts }))))))));
};
var getStyles = function (theme) { return ({
    matchersCell: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    & > * + * {\n      margin-left: ", ";\n    }\n  "], ["\n    & > * + * {\n      margin-left: ", ";\n    }\n  "])), theme.spacing.xs),
    actionsCell: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    text-align: right;\n    width: 1%;\n    white-space: nowrap;\n\n    & > * + * {\n      margin-left: ", ";\n    }\n  "], ["\n    text-align: right;\n    width: 1%;\n    white-space: nowrap;\n\n    & > * + * {\n      margin-left: ", ";\n    }\n  "])), theme.spacing.sm),
    alertRulesCell: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    vertical-align: top;\n  "], ["\n    vertical-align: top;\n  "]))),
}); };
export default SilenceTableRow;
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=SilenceTableRow.js.map