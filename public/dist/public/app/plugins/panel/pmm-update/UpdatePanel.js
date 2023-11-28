import React, { useEffect, useState } from 'react';
import { Button, Spinner } from '@grafana/ui';
import { getPerconaUser, getPerconaSettings } from 'app/percona/shared/core/selectors';
import { useSelector } from 'app/types';
import { Messages } from './UpdatePanel.messages';
import * as styles from './UpdatePanel.styles';
import { AvailableUpdate, CurrentVersion, InfoBox, LastCheck, ProgressModal } from './components';
import { usePerformUpdate, useVersionDetails } from './hooks';
export const UpdatePanel = () => {
    const isOnline = navigator.onLine;
    const [forceUpdate, setForceUpdate] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const { isAuthorized } = useSelector(getPerconaUser);
    const { result: settings, loading: isLoadingSettings } = useSelector(getPerconaSettings);
    const [{ installedVersionDetails, lastCheckDate, nextVersionDetails, isUpdateAvailable }, fetchVersionErrorMessage, isLoadingVersionDetails, isDefaultView, getCurrentVersionDetails,] = useVersionDetails();
    const [output, updateErrorMessage, isUpdated, updateFailed, launchUpdate] = usePerformUpdate();
    const isLoading = isLoadingVersionDetails || isLoadingSettings;
    const handleCheckForUpdates = (e) => {
        if (e.altKey) {
            setForceUpdate(true);
        }
        getCurrentVersionDetails({ force: true });
    };
    useEffect(() => {
        setErrorMessage(fetchVersionErrorMessage || updateErrorMessage);
        const timeout = setTimeout(() => {
            setErrorMessage('');
        }, 5000);
        return () => {
            clearTimeout(timeout);
        };
    }, [fetchVersionErrorMessage, updateErrorMessage]);
    const handleUpdate = () => {
        setShowModal(true);
        launchUpdate();
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.panel },
            React.createElement(CurrentVersion, { installedVersionDetails: installedVersionDetails }),
            isUpdateAvailable && !isDefaultView && !(settings === null || settings === void 0 ? void 0 : settings.updatesDisabled) && isAuthorized && !isLoading && isOnline ? (React.createElement(AvailableUpdate, { nextVersionDetails: nextVersionDetails })) : null,
            isLoading ? (React.createElement("div", { className: styles.middleSectionWrapper },
                React.createElement(Spinner, null))) : (React.createElement(React.Fragment, null, (isUpdateAvailable || forceUpdate) && !(settings === null || settings === void 0 ? void 0 : settings.updatesDisabled) && isAuthorized && isOnline ? (React.createElement("div", { className: styles.middleSectionWrapper },
                React.createElement(Button, { onClick: handleUpdate, icon: 'fa fa-download', variant: "secondary" }, Messages.upgradeTo(nextVersionDetails === null || nextVersionDetails === void 0 ? void 0 : nextVersionDetails.nextVersion)))) : (React.createElement(InfoBox, { upToDate: !isDefaultView && !forceUpdate, hasNoAccess: !isAuthorized, updatesDisabled: settings === null || settings === void 0 ? void 0 : settings.updatesDisabled, isOnline: isOnline })))),
            React.createElement(LastCheck, { disabled: isLoading || (settings === null || settings === void 0 ? void 0 : settings.updatesDisabled) || !isOnline, onCheckForUpdates: handleCheckForUpdates, lastCheckDate: lastCheckDate })),
        React.createElement(ProgressModal, { errorMessage: errorMessage, isOpen: showModal, isUpdated: isUpdated, output: output, updateFailed: updateFailed, version: nextVersionDetails === null || nextVersionDetails === void 0 ? void 0 : nextVersionDetails.nextVersion })));
};
//# sourceMappingURL=UpdatePanel.js.map