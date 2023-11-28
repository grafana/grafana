import { chain, filter } from 'lodash';
import React from 'react';
import { AlertmanagerAction, AlertSourceAction, useAlertSourceAbilities, useAllAlertmanagerAbilities, } from '../hooks/useAbilities';
export const Authorize = ({ actions, children }) => {
    const alertmanagerActions = filter(actions, isAlertmanagerAction);
    const alertSourceActions = filter(actions, isAlertSourceAction);
    if (alertmanagerActions.length) {
        return React.createElement(AuthorizeAlertmanager, { actions: alertmanagerActions }, children);
    }
    if (alertSourceActions.length) {
        return React.createElement(AuthorizeAlertsource, { actions: alertSourceActions }, children);
    }
    return null;
};
const AuthorizeAlertmanager = ({ actions, children }) => {
    const alertmanagerAbilties = useAllAlertmanagerAbilities();
    const allowed = actionsAllowed(alertmanagerAbilties, actions);
    if (allowed) {
        return React.createElement(React.Fragment, null, children);
    }
    else {
        return null;
    }
};
const AuthorizeAlertsource = ({ actions, children }) => {
    const alertSourceAbilities = useAlertSourceAbilities();
    const allowed = actionsAllowed(alertSourceAbilities, actions);
    if (allowed) {
        return React.createElement(React.Fragment, null, children);
    }
    else {
        return null;
    }
};
// check if some action is allowed from the abilities
function actionsAllowed(abilities, actions) {
    return chain(abilities)
        .pick(actions)
        .values()
        .value()
        .some(([_supported, allowed]) => allowed === true);
}
function isAlertmanagerAction(action) {
    return Object.values(AlertmanagerAction).includes(action);
}
function isAlertSourceAction(action) {
    return Object.values(AlertSourceAction).includes(action);
}
//# sourceMappingURL=Authorize.js.map