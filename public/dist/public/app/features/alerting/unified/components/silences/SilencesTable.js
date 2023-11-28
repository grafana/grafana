import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { dateMath } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { CollapsableSection, Icon, Link, LinkButton, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { SilenceState } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';
import { AlertmanagerAction, useAlertmanagerAbility } from '../../hooks/useAbilities';
import { expireSilenceAction } from '../../state/actions';
import { parseMatchers } from '../../utils/alertmanager';
import { getSilenceFiltersFromUrlParams, makeAMLink } from '../../utils/misc';
import { Authorize } from '../Authorize';
import { DynamicTable } from '../DynamicTable';
import { ActionButton } from '../rules/ActionButton';
import { ActionIcon } from '../rules/ActionIcon';
import { Matchers } from './Matchers';
import { NoSilencesSplash } from './NoSilencesCTA';
import { SilenceDetails } from './SilenceDetails';
import { SilenceStateTag } from './SilenceStateTag';
import { SilencesFilter } from './SilencesFilter';
const SilencesTable = ({ silences, alertManagerAlerts, alertManagerSourceName }) => {
    const styles = useStyles2(getStyles);
    const [queryParams] = useQueryParams();
    const filteredSilencesNotExpired = useFilteredSilences(silences, false);
    const filteredSilencesExpired = useFilteredSilences(silences, true);
    const { silenceState: silenceStateInParams } = getSilenceFiltersFromUrlParams(queryParams);
    const showExpiredFromUrl = silenceStateInParams === SilenceState.Expired;
    const itemsNotExpired = useMemo(() => {
        const findSilencedAlerts = (id) => {
            return alertManagerAlerts.filter((alert) => alert.status.silencedBy.includes(id));
        };
        return filteredSilencesNotExpired.map((silence) => {
            const silencedAlerts = findSilencedAlerts(silence.id);
            return {
                id: silence.id,
                data: Object.assign(Object.assign({}, silence), { silencedAlerts }),
            };
        });
    }, [filteredSilencesNotExpired, alertManagerAlerts]);
    const itemsExpired = useMemo(() => {
        const findSilencedAlerts = (id) => {
            return alertManagerAlerts.filter((alert) => alert.status.silencedBy.includes(id));
        };
        return filteredSilencesExpired.map((silence) => {
            const silencedAlerts = findSilencedAlerts(silence.id);
            return {
                id: silence.id,
                data: Object.assign(Object.assign({}, silence), { silencedAlerts }),
            };
        });
    }, [filteredSilencesExpired, alertManagerAlerts]);
    return (React.createElement("div", { "data-testid": "silences-table" },
        !!silences.length && (React.createElement(Stack, { direction: "column" },
            React.createElement(SilencesFilter, null),
            React.createElement(Authorize, { actions: [AlertmanagerAction.CreateSilence] },
                React.createElement("div", { className: styles.topButtonContainer },
                    React.createElement(LinkButton, { href: makeAMLink('/alerting/silence/new', alertManagerSourceName), icon: "plus" }, "Add Silence"))),
            React.createElement(SilenceList, { items: itemsNotExpired, alertManagerSourceName: alertManagerSourceName, dataTestId: "not-expired-table" }),
            itemsExpired.length > 0 && (React.createElement(CollapsableSection, { label: `Expired silences (${itemsExpired.length})`, isOpen: showExpiredFromUrl },
                React.createElement("div", { className: styles.callout },
                    React.createElement(Icon, { className: styles.calloutIcon, name: "info-circle" }),
                    React.createElement("span", null, "Expired silences are automatically deleted after 5 days.")),
                React.createElement(SilenceList, { items: itemsExpired, alertManagerSourceName: alertManagerSourceName, dataTestId: "expired-table" }))))),
        !silences.length && React.createElement(NoSilencesSplash, { alertManagerSourceName: alertManagerSourceName })));
};
function SilenceList({ items, alertManagerSourceName, dataTestId, }) {
    const columns = useColumns(alertManagerSourceName);
    if (!!items.length) {
        return (React.createElement(DynamicTable, { pagination: { itemsPerPage: 25 }, items: items, cols: columns, isExpandable: true, dataTestId: dataTestId, renderExpandedContent: ({ data }) => React.createElement(SilenceDetails, { silence: data }) }));
    }
    else {
        return React.createElement(React.Fragment, null, "No matching silences found");
    }
}
const useFilteredSilences = (silences, expired = false) => {
    const [queryParams] = useQueryParams();
    return useMemo(() => {
        const { queryString } = getSilenceFiltersFromUrlParams(queryParams);
        const silenceIdsString = queryParams === null || queryParams === void 0 ? void 0 : queryParams.silenceIds;
        return silences.filter((silence) => {
            if (typeof silenceIdsString === 'string') {
                const idsIncluded = silenceIdsString.split(',').includes(silence.id);
                if (!idsIncluded) {
                    return false;
                }
            }
            if (queryString) {
                const matchers = parseMatchers(queryString);
                const matchersMatch = matchers.every((matcher) => {
                    var _a;
                    return (_a = silence.matchers) === null || _a === void 0 ? void 0 : _a.some(({ name, value, isEqual, isRegex }) => matcher.name === name &&
                        matcher.value === value &&
                        matcher.isEqual === isEqual &&
                        matcher.isRegex === isRegex);
                });
                if (!matchersMatch) {
                    return false;
                }
            }
            if (expired) {
                return silence.status.state === SilenceState.Expired;
            }
            else {
                return silence.status.state !== SilenceState.Expired;
            }
        });
    }, [queryParams, silences, expired]);
};
const getStyles = (theme) => ({
    topButtonContainer: css `
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
  `,
    addNewSilence: css `
    margin: ${theme.spacing(2, 0)};
  `,
    callout: css `
    background-color: ${theme.colors.background.secondary};
    border-top: 3px solid ${theme.colors.info.border};
    border-radius: ${theme.shape.radius.default};
    height: 62px;
    display: flex;
    flex-direction: row;
    align-items: center;

    & > * {
      margin-left: ${theme.spacing(1)};
    }
  `,
    calloutIcon: css `
    color: ${theme.colors.info.text};
  `,
    editButton: css `
    margin-left: ${theme.spacing(0.5)};
  `,
});
function useColumns(alertManagerSourceName) {
    const dispatch = useDispatch();
    const styles = useStyles2(getStyles);
    const [updateSupported, updateAllowed] = useAlertmanagerAbility(AlertmanagerAction.UpdateSilence);
    return useMemo(() => {
        const handleExpireSilenceClick = (id) => {
            dispatch(expireSilenceAction(alertManagerSourceName, id));
        };
        const columns = [
            {
                id: 'state',
                label: 'State',
                renderCell: function renderStateTag({ data: { status } }) {
                    return React.createElement(SilenceStateTag, { state: status.state });
                },
                size: 4,
            },
            {
                id: 'matchers',
                label: 'Matching labels',
                renderCell: function renderMatchers({ data: { matchers } }) {
                    return React.createElement(Matchers, { matchers: matchers || [] });
                },
                size: 10,
            },
            {
                id: 'alerts',
                label: 'Alerts',
                renderCell: function renderSilencedAlerts({ data: { silencedAlerts } }) {
                    return React.createElement("span", { "data-testid": "alerts" }, silencedAlerts.length);
                },
                size: 4,
            },
            {
                id: 'schedule',
                label: 'Schedule',
                renderCell: function renderSchedule({ data: { startsAt, endsAt } }) {
                    const startsAtDate = dateMath.parse(startsAt);
                    const endsAtDate = dateMath.parse(endsAt);
                    const dateDisplayFormat = 'YYYY-MM-DD HH:mm';
                    return (React.createElement(React.Fragment, null,
                        ' ', startsAtDate === null || startsAtDate === void 0 ? void 0 :
                        startsAtDate.format(dateDisplayFormat),
                        " ",
                        '-', endsAtDate === null || endsAtDate === void 0 ? void 0 :
                        endsAtDate.format(dateDisplayFormat)));
                },
                size: 7,
            },
        ];
        if (updateSupported && updateAllowed) {
            columns.push({
                id: 'actions',
                label: 'Actions',
                renderCell: function renderActions({ data: silence }) {
                    return (React.createElement(Stack, { gap: 0.5 },
                        silence.status.state === 'expired' ? (React.createElement(Link, { href: makeAMLink(`/alerting/silence/${silence.id}/edit`, alertManagerSourceName) },
                            React.createElement(ActionButton, { icon: "sync" }, "Recreate"))) : (React.createElement(ActionButton, { icon: "bell", onClick: () => handleExpireSilenceClick(silence.id) }, "Unsilence")),
                        silence.status.state !== 'expired' && (React.createElement(ActionIcon, { className: styles.editButton, to: makeAMLink(`/alerting/silence/${silence.id}/edit`, alertManagerSourceName), icon: "pen", tooltip: "edit" }))));
                },
                size: 5,
            });
        }
        return columns;
    }, [alertManagerSourceName, dispatch, styles.editButton, updateAllowed, updateSupported]);
}
export default SilencesTable;
//# sourceMappingURL=SilencesTable.js.map