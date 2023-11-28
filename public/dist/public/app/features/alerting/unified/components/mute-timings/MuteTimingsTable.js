import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';
import { Stack } from '@grafana/experimental';
import { IconButton, LinkButton, Link, useStyles2, ConfirmModal } from '@grafana/ui';
import { useDispatch } from 'app/types/store';
import { Authorize } from '../../components/Authorize';
import { AlertmanagerAction, useAlertmanagerAbilities, useAlertmanagerAbility } from '../../hooks/useAbilities';
import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { deleteMuteTimingAction } from '../../state/actions';
import { makeAMLink } from '../../utils/misc';
import { DynamicTable } from '../DynamicTable';
import { EmptyAreaWithCTA } from '../EmptyAreaWithCTA';
import { ProvisioningBadge } from '../Provisioning';
import { Spacer } from '../Spacer';
import { renderTimeIntervals } from './util';
export const MuteTimingsTable = ({ alertManagerSourceName, muteTimingNames, hideActions }) => {
    const styles = useStyles2(getStyles);
    const dispatch = useDispatch();
    const { currentData } = useAlertmanagerConfig(alertManagerSourceName, {
        refetchOnFocus: true,
        refetchOnReconnect: true,
    });
    const config = currentData === null || currentData === void 0 ? void 0 : currentData.alertmanager_config;
    const [muteTimingName, setMuteTimingName] = useState('');
    const items = useMemo(() => {
        var _a, _b;
        const muteTimings = (_a = config === null || config === void 0 ? void 0 : config.mute_time_intervals) !== null && _a !== void 0 ? _a : [];
        const muteTimingsProvenances = (_b = config === null || config === void 0 ? void 0 : config.muteTimeProvenances) !== null && _b !== void 0 ? _b : {};
        return muteTimings
            .filter(({ name }) => (muteTimingNames ? muteTimingNames.includes(name) : true))
            .map((mute) => {
            return {
                id: mute.name,
                data: Object.assign(Object.assign({}, mute), { provenance: muteTimingsProvenances[mute.name] }),
            };
        });
    }, [config === null || config === void 0 ? void 0 : config.mute_time_intervals, config === null || config === void 0 ? void 0 : config.muteTimeProvenances, muteTimingNames]);
    const columns = useColumns(alertManagerSourceName, hideActions, setMuteTimingName);
    const [_, allowedToCreateMuteTiming] = useAlertmanagerAbility(AlertmanagerAction.CreateMuteTiming);
    return (React.createElement("div", { className: styles.container },
        React.createElement(Stack, { direction: "row", alignItems: "center" },
            React.createElement("span", null, "Enter specific time intervals when not to send notifications or freeze notifications for recurring periods of time."),
            React.createElement(Spacer, null),
            !hideActions && items.length > 0 && (React.createElement(Authorize, { actions: [AlertmanagerAction.CreateMuteTiming] },
                React.createElement(LinkButton, { className: styles.addMuteButton, icon: "plus", variant: "primary", href: makeAMLink('alerting/routes/mute-timing/new', alertManagerSourceName) }, "Add mute timing")))),
        items.length > 0 ? (React.createElement(DynamicTable, { items: items, cols: columns, pagination: { itemsPerPage: 25 } })) : !hideActions ? (React.createElement(EmptyAreaWithCTA, { text: "You haven't created any mute timings yet", buttonLabel: "Add mute timing", buttonIcon: "plus", buttonSize: "lg", href: makeAMLink('alerting/routes/mute-timing/new', alertManagerSourceName), showButton: allowedToCreateMuteTiming })) : (React.createElement(EmptyAreaWithCTA, { text: "No mute timings configured", buttonLabel: '', showButton: false })),
        !hideActions && (React.createElement(ConfirmModal, { isOpen: !!muteTimingName, title: "Delete mute timing", body: `Are you sure you would like to delete "${muteTimingName}"`, confirmText: "Delete", onConfirm: () => {
                dispatch(deleteMuteTimingAction(alertManagerSourceName, muteTimingName));
                setMuteTimingName('');
            }, onDismiss: () => setMuteTimingName('') }))));
};
function useColumns(alertManagerSourceName, hideActions = false, setMuteTimingName) {
    const [[_editSupported, allowedToEdit], [_deleteSupported, allowedToDelete]] = useAlertmanagerAbilities([
        AlertmanagerAction.UpdateMuteTiming,
        AlertmanagerAction.DeleteMuteTiming,
    ]);
    const showActions = !hideActions && (allowedToEdit || allowedToDelete);
    return useMemo(() => {
        const columns = [
            {
                id: 'name',
                label: 'Name',
                renderCell: function renderName({ data }) {
                    return (React.createElement(React.Fragment, null,
                        data.name,
                        " ",
                        data.provenance && React.createElement(ProvisioningBadge, null)));
                },
                size: '250px',
            },
            {
                id: 'timeRange',
                label: 'Time range',
                renderCell: ({ data }) => {
                    return renderTimeIntervals(data);
                },
            },
        ];
        if (showActions) {
            columns.push({
                id: 'actions',
                label: 'Actions',
                renderCell: function renderActions({ data }) {
                    if (data.provenance) {
                        return (React.createElement("div", null,
                            React.createElement(Link, { href: makeAMLink(`/alerting/routes/mute-timing/edit`, alertManagerSourceName, {
                                    muteName: data.name,
                                }) },
                                React.createElement(IconButton, { name: "file-alt", tooltip: "View mute timing" }))));
                    }
                    return (React.createElement("div", null,
                        React.createElement(Authorize, { actions: [AlertmanagerAction.UpdateMuteTiming] },
                            React.createElement(Link, { href: makeAMLink(`/alerting/routes/mute-timing/edit`, alertManagerSourceName, {
                                    muteName: data.name,
                                }) },
                                React.createElement(IconButton, { name: "edit", tooltip: "Edit mute timing" }))),
                        React.createElement(Authorize, { actions: [AlertmanagerAction.DeleteMuteTiming] },
                            React.createElement(IconButton, { name: "trash-alt", tooltip: "Delete mute timing", onClick: () => setMuteTimingName(data.name) }))));
                },
                size: '100px',
            });
        }
        return columns;
    }, [alertManagerSourceName, setMuteTimingName, showActions]);
}
const getStyles = (theme) => ({
    container: css `
    display: flex;
    flex-flow: column nowrap;
  `,
    addMuteButton: css `
    margin-bottom: ${theme.spacing(2)};
    align-self: flex-end;
  `,
});
//# sourceMappingURL=MuteTimingsTable.js.map