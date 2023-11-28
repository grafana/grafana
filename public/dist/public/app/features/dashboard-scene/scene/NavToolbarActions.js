import React from 'react';
import { locationService } from '@grafana/runtime';
import { Button } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { NavToolbarSeparator } from 'app/core/components/AppChrome/NavToolbar/NavToolbarSeparator';
import { t } from 'app/core/internationalization';
import { DashNavButton } from 'app/features/dashboard/components/DashNav/DashNavButton';
import { ShareModal } from '../sharing/ShareModal';
export const NavToolbarActions = React.memo(({ dashboard }) => {
    const { actions = [], isEditing, viewPanelKey, isDirty, uid } = dashboard.useState();
    const toolbarActions = (actions !== null && actions !== void 0 ? actions : []).map((action) => React.createElement(action.Component, { key: action.state.key, model: action }));
    if (uid) {
        toolbarActions.push(React.createElement(DashNavButton, { key: "share-dashboard-button", tooltip: t('dashboard.toolbar.share', 'Share dashboard'), icon: "share-alt", iconSize: "lg", onClick: () => {
                dashboard.showModal(new ShareModal({ dashboardRef: dashboard.getRef() }));
            } }));
        toolbarActions.push(React.createElement(DashNavButton, { key: "view-in-old-dashboard-button", tooltip: 'View as dashboard', icon: "apps", onClick: () => locationService.push(`/d/${uid}`) }));
    }
    toolbarActions.push(React.createElement(NavToolbarSeparator, { leftActionsSeparator: true, key: "separator" }));
    if (viewPanelKey) {
        toolbarActions.push(React.createElement(Button, { onClick: () => locationService.partial({ viewPanel: null }), tooltip: "", key: "back", variant: "primary", fill: "text" }, "Back to dashboard"));
        return React.createElement(AppChromeUpdate, { actions: toolbarActions });
    }
    if (!isEditing) {
        // TODO check permissions
        toolbarActions.push(React.createElement(Button, { onClick: dashboard.onEnterEditMode, tooltip: "Enter edit mode", key: "edit", variant: "primary", icon: "pen", fill: "text" }, "Edit"));
    }
    else {
        // TODO check permissions
        toolbarActions.push(React.createElement(Button, { onClick: dashboard.onSave, tooltip: "Save as copy", fill: "text", key: "save-as" }, "Save as"));
        toolbarActions.push(React.createElement(Button, { onClick: dashboard.onDiscard, tooltip: "Save changes", fill: "text", key: "discard", variant: "destructive" }, "Discard"));
        toolbarActions.push(React.createElement(Button, { onClick: dashboard.onSave, tooltip: "Save changes", key: "save", disabled: !isDirty }, "Save"));
    }
    return React.createElement(AppChromeUpdate, { actions: toolbarActions });
});
NavToolbarActions.displayName = 'NavToolbarActions';
//# sourceMappingURL=NavToolbarActions.js.map