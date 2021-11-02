import { __assign, __makeTemplateObject, __read } from "tslib";
import React, { useMemo } from 'react';
import { dateMath } from '@grafana/data';
import { Icon, useStyles2, Link, Button } from '@grafana/ui';
import { css } from '@emotion/css';
import { SilenceState } from 'app/plugins/datasource/alertmanager/types';
import { NoSilencesSplash } from './NoSilencesCTA';
import { getSilenceFiltersFromUrlParams, makeAMLink } from '../../utils/misc';
import { contextSrv } from 'app/core/services/context_srv';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { SilencesFilter } from './SilencesFilter';
import { parseMatchers } from '../../utils/alertmanager';
import { DynamicTable } from '../DynamicTable';
import { SilenceStateTag } from './SilenceStateTag';
import { Matchers } from './Matchers';
import { ActionButton } from '../rules/ActionButton';
import { ActionIcon } from '../rules/ActionIcon';
import { useDispatch } from 'react-redux';
import { expireSilenceAction } from '../../state/actions';
import { SilenceDetails } from './SilenceDetails';
var SilencesTable = function (_a) {
    var silences = _a.silences, alertManagerAlerts = _a.alertManagerAlerts, alertManagerSourceName = _a.alertManagerSourceName;
    var styles = useStyles2(getStyles);
    var _b = __read(useQueryParams(), 1), queryParams = _b[0];
    var filteredSilences = useFilteredSilences(silences);
    var silenceState = getSilenceFiltersFromUrlParams(queryParams).silenceState;
    var showExpiredSilencesBanner = !!filteredSilences.length && (silenceState === undefined || silenceState === SilenceState.Expired);
    var columns = useColumns(alertManagerSourceName);
    var items = useMemo(function () {
        var findSilencedAlerts = function (id) {
            return alertManagerAlerts.filter(function (alert) { return alert.status.silencedBy.includes(id); });
        };
        return filteredSilences.map(function (silence) {
            var silencedAlerts = findSilencedAlerts(silence.id);
            return {
                id: silence.id,
                data: __assign(__assign({}, silence), { silencedAlerts: silencedAlerts }),
            };
        });
    }, [filteredSilences, alertManagerAlerts]);
    return (React.createElement("div", { "data-testid": "silences-table" },
        !!silences.length && (React.createElement(React.Fragment, null,
            React.createElement(SilencesFilter, null),
            contextSrv.isEditor && (React.createElement("div", { className: styles.topButtonContainer },
                React.createElement(Link, { href: makeAMLink('/alerting/silence/new', alertManagerSourceName) },
                    React.createElement(Button, { className: styles.addNewSilence, icon: "plus" }, "New Silence")))),
            !!items.length ? (React.createElement(React.Fragment, null,
                React.createElement(DynamicTable, { items: items, cols: columns, isExpandable: true, renderExpandedContent: function (_a) {
                        var data = _a.data;
                        return React.createElement(SilenceDetails, { silence: data });
                    } }),
                showExpiredSilencesBanner && (React.createElement("div", { className: styles.callout },
                    React.createElement(Icon, { className: styles.calloutIcon, name: "info-circle" }),
                    React.createElement("span", null, "Expired silences are automatically deleted after 5 days."))))) : ('No matching silences found'))),
        !silences.length && React.createElement(NoSilencesSplash, { alertManagerSourceName: alertManagerSourceName })));
};
var useFilteredSilences = function (silences) {
    var _a = __read(useQueryParams(), 1), queryParams = _a[0];
    return useMemo(function () {
        var _a = getSilenceFiltersFromUrlParams(queryParams), queryString = _a.queryString, silenceState = _a.silenceState;
        var silenceIdsString = queryParams === null || queryParams === void 0 ? void 0 : queryParams.silenceIds;
        return silences.filter(function (silence) {
            if (typeof silenceIdsString === 'string') {
                var idsIncluded = silenceIdsString.split(',').includes(silence.id);
                if (!idsIncluded) {
                    return false;
                }
            }
            if (queryString) {
                var matchers = parseMatchers(queryString);
                var matchersMatch = matchers.every(function (matcher) {
                    var _a;
                    return (_a = silence.matchers) === null || _a === void 0 ? void 0 : _a.some(function (_a) {
                        var name = _a.name, value = _a.value, isEqual = _a.isEqual, isRegex = _a.isRegex;
                        return matcher.name === name &&
                            matcher.value === value &&
                            matcher.isEqual === isEqual &&
                            matcher.isRegex === isRegex;
                    });
                });
                if (!matchersMatch) {
                    return false;
                }
            }
            if (silenceState) {
                var stateMatches = silence.status.state === silenceState;
                if (!stateMatches) {
                    return false;
                }
            }
            return true;
        });
    }, [queryParams, silences]);
};
var getStyles = function (theme) { return ({
    topButtonContainer: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: row;\n    justify-content: flex-end;\n  "], ["\n    display: flex;\n    flex-direction: row;\n    justify-content: flex-end;\n  "]))),
    addNewSilence: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    margin: ", ";\n  "], ["\n    margin: ", ";\n  "])), theme.spacing(2, 0)),
    callout: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    background-color: ", ";\n    border-top: 3px solid ", ";\n    border-radius: 2px;\n    height: 62px;\n    display: flex;\n    flex-direction: row;\n    align-items: center;\n    margin-top: ", ";\n\n    & > * {\n      margin-left: ", ";\n    }\n  "], ["\n    background-color: ", ";\n    border-top: 3px solid ", ";\n    border-radius: 2px;\n    height: 62px;\n    display: flex;\n    flex-direction: row;\n    align-items: center;\n    margin-top: ", ";\n\n    & > * {\n      margin-left: ", ";\n    }\n  "])), theme.colors.background.secondary, theme.colors.info.border, theme.spacing(2), theme.spacing(1)),
    calloutIcon: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    color: ", ";\n  "], ["\n    color: ", ";\n  "])), theme.colors.info.text),
    editButton: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    margin-left: ", ";\n  "], ["\n    margin-left: ", ";\n  "])), theme.spacing(0.5)),
}); };
function useColumns(alertManagerSourceName) {
    var dispatch = useDispatch();
    var styles = useStyles2(getStyles);
    return useMemo(function () {
        var handleExpireSilenceClick = function (id) {
            dispatch(expireSilenceAction(alertManagerSourceName, id));
        };
        var showActions = contextSrv.isEditor;
        var columns = [
            {
                id: 'state',
                label: 'State',
                renderCell: function renderStateTag(_a) {
                    var status = _a.data.status;
                    return React.createElement(SilenceStateTag, { state: status.state });
                },
                size: '88px',
            },
            {
                id: 'matchers',
                label: 'Matching labels',
                renderCell: function renderMatchers(_a) {
                    var matchers = _a.data.matchers;
                    return React.createElement(Matchers, { matchers: matchers || [] });
                },
                size: 9,
            },
            {
                id: 'alerts',
                label: 'Alerts',
                renderCell: function renderSilencedAlerts(_a) {
                    var silencedAlerts = _a.data.silencedAlerts;
                    return React.createElement("span", { "data-testid": "alerts" }, silencedAlerts.length);
                },
                size: 1,
            },
            {
                id: 'schedule',
                label: 'Schedule',
                renderCell: function renderSchedule(_a) {
                    var _b = _a.data, startsAt = _b.startsAt, endsAt = _b.endsAt;
                    var startsAtDate = dateMath.parse(startsAt);
                    var endsAtDate = dateMath.parse(endsAt);
                    var dateDisplayFormat = 'YYYY-MM-DD HH:mm';
                    return (React.createElement(React.Fragment, null,
                        ' ', startsAtDate === null || startsAtDate === void 0 ? void 0 :
                        startsAtDate.format(dateDisplayFormat),
                        " ",
                        '-',
                        React.createElement("br", null), endsAtDate === null || endsAtDate === void 0 ? void 0 :
                        endsAtDate.format(dateDisplayFormat)));
                },
                size: '150px',
            },
        ];
        if (showActions) {
            columns.push({
                id: 'actions',
                label: 'Actions',
                renderCell: function renderActions(_a) {
                    var silence = _a.data;
                    return (React.createElement(React.Fragment, null,
                        silence.status.state === 'expired' ? (React.createElement(Link, { href: makeAMLink("/alerting/silence/" + silence.id + "/edit", alertManagerSourceName) },
                            React.createElement(ActionButton, { icon: "sync" }, "Recreate"))) : (React.createElement(ActionButton, { icon: "bell", onClick: function () { return handleExpireSilenceClick(silence.id); } }, "Unsilence")),
                        silence.status.state !== 'expired' && (React.createElement(ActionIcon, { className: styles.editButton, to: makeAMLink("/alerting/silence/" + silence.id + "/edit", alertManagerSourceName), icon: "pen", tooltip: "edit" }))));
                },
                size: '140px',
            });
        }
        return columns;
    }, [alertManagerSourceName, dispatch, styles]);
}
export default SilencesTable;
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=SilencesTable.js.map