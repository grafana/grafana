import { __awaiter } from "tslib";
import { AxiosError } from 'axios';
import React, { useEffect, useState } from 'react';
import { AppEvents } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { OldPage } from 'app/core/components/Page/Page';
import { getSettingsStyles } from 'app/percona/settings/Settings.styles';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { fetchServerInfoAction, fetchSettingsAction, updateSettingsAction } from 'app/percona/shared/core/reducers';
import { getPerconaServer, getPerconaSettings } from 'app/percona/shared/core/selectors';
import { logger } from 'app/percona/shared/helpers/logger';
import { useDispatch, useSelector } from 'app/types';
import { Connect } from './Connect/Connect';
import { Connected } from './Connected/Connected';
import { API_INVALID_TOKEN_ERROR_CODE, CONNECT_AFTER_SETTINGS_DELAY, CONNECT_DELAY } from './Platform.constants';
import { Messages } from './Platform.messages';
import { PlatformService } from './Platform.service';
export const Platform = () => {
    const navModel = usePerconaNavModel('settings-percona-platform');
    const settingsStyles = useStyles2(getSettingsStyles);
    const { result } = useSelector(getPerconaSettings);
    const [connecting, setConnecting] = useState(false);
    const { serverId: pmmServerId = '' } = useSelector(getPerconaServer);
    const dispatch = useDispatch();
    const [initialValues, setInitialValues] = useState({
        pmmServerName: '',
        pmmServerId,
        accessToken: '',
    });
    useEffect(() => setInitialValues((oldValues) => (Object.assign(Object.assign({}, oldValues), { pmmServerId }))), [pmmServerId]);
    const connect = (pmmServerName, accessToken) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        try {
            yield PlatformService.connect({
                server_name: pmmServerName,
                personal_access_token: accessToken,
            });
            // We need some short delay for changes to apply before immediately calling getSettings
            setTimeout(() => __awaiter(void 0, void 0, void 0, function* () {
                appEvents.emit(AppEvents.alertSuccess, [Messages.connectSucceeded]);
                setConnecting(false);
                dispatch(fetchServerInfoAction());
                dispatch(fetchSettingsAction());
                setInitialValues((oldValues) => (Object.assign(Object.assign({}, oldValues), { pmmServerName: '', accessToken: '' })));
            }), CONNECT_DELAY);
        }
        catch (e) {
            let message = null;
            if (e instanceof AxiosError) {
                if (((_b = (_a = e.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.code) === API_INVALID_TOKEN_ERROR_CODE) {
                    message = Messages.invalidToken;
                }
                else {
                    message = (_d = (_c = e.response) === null || _c === void 0 ? void 0 : _c.data.message) !== null && _d !== void 0 ? _d : e.message;
                }
            }
            appEvents.emit(AppEvents.alertError, [message !== null && message !== void 0 ? message : Messages.unknownError]);
            logger.error(e);
            setConnecting(false);
        }
    });
    const handleConnect = ({ pmmServerName, accessToken }, setPMMAddress) => __awaiter(void 0, void 0, void 0, function* () {
        setInitialValues((oldValues) => (Object.assign(Object.assign({}, oldValues), { pmmServerName, accessToken })));
        setConnecting(true);
        if (setPMMAddress) {
            yield dispatch(updateSettingsAction({ body: { pmm_public_address: window.location.host } }));
            setTimeout(() => connect(pmmServerName, accessToken), CONNECT_AFTER_SETTINGS_DELAY);
        }
        else {
            connect(pmmServerName, accessToken);
        }
    });
    return (React.createElement(OldPage, { navModel: navModel, vertical: true, tabsDataTestId: "settings-tabs" },
        React.createElement(OldPage.Contents, { dataTestId: "settings-tab-content", className: settingsStyles.pageContent },
            React.createElement(FeatureLoader, null, (result === null || result === void 0 ? void 0 : result.isConnectedToPortal) ? (React.createElement(Connected, null)) : (React.createElement(Connect, { initialValues: initialValues, onConnect: handleConnect, connecting: connecting }))))));
};
export default Platform;
//# sourceMappingURL=Platform.js.map