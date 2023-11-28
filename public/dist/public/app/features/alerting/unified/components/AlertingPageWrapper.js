import { __rest } from "tslib";
import Mousetrap from 'mousetrap';
import React, { useEffect, useState } from 'react';
import { Features, ToggleFeatures } from 'react-enable';
import { useLocation } from 'react-use';
import { Page } from 'app/core/components/Page/Page';
import FEATURES from '../features';
import { AlertmanagerProvider, useAlertmanager } from '../state/AlertmanagerContext';
import { AlertManagerPicker } from './AlertManagerPicker';
import { NoAlertManagerWarning } from './NoAlertManagerWarning';
const SHOW_TOGGLES_KEY_COMBO = 'ctrl+1';
const combokeys = new Mousetrap(document.body);
export const AlertingPageWrapper = ({ children, pageId, pageNav, actions, isLoading }) => {
    const [showFeatureToggle, setShowFeatureToggles] = useState(false);
    useEffect(() => {
        combokeys.bind(SHOW_TOGGLES_KEY_COMBO, () => {
            setShowFeatureToggles((show) => !show);
        });
        return () => {
            combokeys.unbind(SHOW_TOGGLES_KEY_COMBO);
        };
    }, []);
    return (React.createElement(Features, { features: FEATURES },
        React.createElement(Page, { pageNav: pageNav, navId: pageId, actions: actions },
            React.createElement(Page.Contents, { isLoading: isLoading }, children)),
        showFeatureToggle ? React.createElement(ToggleFeatures, { defaultOpen: true }) : null));
};
export const AlertmanagerPageWrapper = (_a) => {
    var { children, accessType } = _a, props = __rest(_a, ["children", "accessType"]);
    const disableAlertmanager = useIsDisabledAlertmanagerSelection();
    return (React.createElement(AlertmanagerProvider, { accessType: accessType },
        React.createElement(AlertingPageWrapper, Object.assign({}, props, { actions: React.createElement(AlertManagerPicker, { disabled: disableAlertmanager }) }),
            React.createElement(AlertManagerPagePermissionsCheck, null, children))));
};
/**
 * This function tells us when we want to disable the alertmanager picker
 * It's not great...
 */
function useIsDisabledAlertmanagerSelection() {
    const location = useLocation();
    const disabledPathSegment = ['/edit', '/new'];
    return disabledPathSegment.some((match) => { var _a; return (_a = location === null || location === void 0 ? void 0 : location.pathname) === null || _a === void 0 ? void 0 : _a.includes(match); });
}
/**
 * This component will render an error message if the user doesn't have sufficient permissions or if the requested
 * alertmanager doesn't exist
 */
const AlertManagerPagePermissionsCheck = ({ children }) => {
    const { availableAlertManagers, selectedAlertmanager } = useAlertmanager();
    if (!selectedAlertmanager) {
        return React.createElement(NoAlertManagerWarning, { availableAlertManagers: availableAlertManagers });
    }
    return React.createElement(React.Fragment, null, children);
};
//# sourceMappingURL=AlertingPageWrapper.js.map