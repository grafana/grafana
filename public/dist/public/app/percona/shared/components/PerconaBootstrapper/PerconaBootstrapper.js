import { __awaiter } from "tslib";
import React, { useEffect, useState } from 'react';
import { config } from '@grafana/runtime';
import { Button, HorizontalGroup, Icon, Modal, useStyles2, useTheme2 } from '@grafana/ui';
import { fetchServerInfoAction, fetchServerSaasHostAction, fetchSettingsAction, } from 'app/percona/shared/core/reducers';
import { fetchAdvisors } from 'app/percona/shared/core/reducers/advisors/advisors';
import { TourType } from 'app/percona/shared/core/reducers/tour/tour.types';
import { fetchUserDetailsAction, fetchUserStatusAction, setAuthorized, } from 'app/percona/shared/core/reducers/user/user';
import { useAppDispatch } from 'app/store/store';
import { Telemetry } from '../../../ui-events/components/Telemetry';
import usePerconaTour from '../../core/hooks/tour';
import { isPmmAdmin } from '../../helpers/permissions';
import { Messages } from './PerconaBootstrapper.messages';
import { getStyles } from './PerconaBootstrapper.styles';
import PerconaNavigation from './PerconaNavigation/PerconaNavigation';
import PerconaTourBootstrapper from './PerconaTour';
// This component is only responsible for populating the store with Percona's settings initially
export const PerconaBootstrapper = ({ onReady }) => {
    const dispatch = useAppDispatch();
    const { setSteps, startTour: startPerconaTour, endTour } = usePerconaTour();
    const [modalIsOpen, setModalIsOpen] = useState(true);
    const [showTour, setShowTour] = useState(false);
    const styles = useStyles2(getStyles);
    const { user } = config.bootData;
    const { isSignedIn } = user;
    const theme = useTheme2();
    const dismissModal = () => {
        setModalIsOpen(false);
    };
    const finishTour = () => {
        setModalIsOpen(false);
        setShowTour(false);
        endTour(TourType.Product);
    };
    const startTour = () => {
        setModalIsOpen(false);
        startPerconaTour(TourType.Product);
    };
    useEffect(() => {
        const getSettings = () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            try {
                yield dispatch(fetchSettingsAction()).unwrap();
                dispatch(setAuthorized(true));
            }
            catch (e) {
                // @ts-ignore
                if (((_a = e.response) === null || _a === void 0 ? void 0 : _a.status) === 401) {
                    setAuthorized(false);
                }
            }
        });
        const getUserDetails = () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const details = yield dispatch(fetchUserDetailsAction()).unwrap();
                setShowTour(!details.productTourCompleted);
            }
            catch (e) {
                setShowTour(false);
            }
        });
        const bootstrap = () => __awaiter(void 0, void 0, void 0, function* () {
            if (isPmmAdmin(user)) {
                yield getSettings();
                yield dispatch(fetchUserStatusAction());
                yield dispatch(fetchAdvisors({ disableNotifications: true }));
            }
            yield getUserDetails();
            yield dispatch(fetchServerInfoAction());
            yield dispatch(fetchServerSaasHostAction());
            onReady();
        });
        if (isSignedIn) {
            bootstrap();
        }
        else {
            onReady();
        }
    }, [dispatch, isSignedIn, setSteps, onReady, user]);
    return (React.createElement(React.Fragment, null,
        isSignedIn && React.createElement(Telemetry, null),
        React.createElement(PerconaNavigation, null),
        React.createElement(PerconaTourBootstrapper, null),
        isSignedIn && showTour && (React.createElement(Modal, { onDismiss: dismissModal, isOpen: modalIsOpen, title: Messages.title },
            React.createElement("div", { className: styles.iconContainer },
                React.createElement(Icon, { type: "mono", name: theme.isLight ? 'pmm-logo-light' : 'pmm-logo', className: styles.svg })),
            React.createElement("p", null,
                React.createElement("strong", null, Messages.pmm),
                Messages.pmmIs),
            React.createElement("p", null,
                Messages.pmmEnables,
                React.createElement("ul", { className: styles.list },
                    React.createElement("li", null, Messages.spotCriticalPerformance),
                    React.createElement("li", null, Messages.ensureDbPerformance),
                    React.createElement("li", null, Messages.backup))),
            React.createElement("p", null,
                Messages.moreInfo,
                React.createElement("a", { href: "https://per.co.na/pmm_documentation", target: "_blank", rel: "noreferrer noopener", className: styles.docsLink }, Messages.pmmOnlineHelp),
                "."),
            React.createElement(HorizontalGroup, { justify: "center", spacing: "md" },
                React.createElement(Button, { onClick: startTour, size: "lg", className: styles.callToAction }, Messages.startTour)),
            React.createElement(HorizontalGroup, { justify: "flex-end", spacing: "md" },
                React.createElement(Button, { variant: "secondary", onClick: finishTour }, Messages.skip),
                React.createElement(Button, { variant: "secondary", onClick: () => setModalIsOpen(false) }, Messages.checkLater))))));
};
//# sourceMappingURL=PerconaBootstrapper.js.map