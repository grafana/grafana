import { css } from '@emotion/css';
import React from 'react';
import { locationService } from '@grafana/runtime';
import { Button, Modal, stylesFactory, useStyles2 } from '@grafana/ui';
import { dashboardWatcher } from './dashboardWatcher';
import { DashboardEventAction } from './types';
export function DashboardChangedModal({ onDismiss, event }) {
    const styles = useStyles2(getStyles);
    const onDiscardChanges = () => {
        if ((event === null || event === void 0 ? void 0 : event.action) === DashboardEventAction.Deleted) {
            locationService.push('/');
            return;
        }
        dashboardWatcher.reloadPage();
        onDismiss();
    };
    return (React.createElement(Modal, { isOpen: true, title: "Dashboard changed", icon: "copy", onDismiss: onDismiss, onClickBackdrop: () => { }, className: styles.modal },
        React.createElement("div", { className: styles.description }, "The dashboad has been updated by another session. Do you want to continue editing or discard your local changes?"),
        React.createElement(Modal.ButtonRow, null,
            React.createElement(Button, { onClick: onDismiss, variant: "secondary", fill: "outline" }, "Continue editing"),
            React.createElement(Button, { onClick: onDiscardChanges, variant: "destructive" }, "Discard local changes"))));
}
const getStyles = stylesFactory((theme) => {
    return {
        modal: css({ width: '600px' }),
        description: css({
            color: theme.colors.text.secondary,
            paddingBottom: theme.spacing(1),
        }),
    };
});
//# sourceMappingURL=DashboardChangedModal.js.map