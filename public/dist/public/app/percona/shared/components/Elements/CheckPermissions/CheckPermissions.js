import { __awaiter } from "tslib";
import React, { useEffect, useState } from 'react';
import { Spinner, useStyles } from '@grafana/ui';
import { SettingsService } from 'app/percona/settings/Settings.service';
import { EmptyBlock } from 'app/percona/shared/components/Elements/EmptyBlock';
import { logger } from 'app/percona/shared/helpers/logger';
import { Messages } from './CheckPermissions.messages';
import { getStyles } from './CheckPermissions.styles';
export const CheckPermissions = ({ children, onSettingsLoadSuccess, onSettingsLoadError, }) => {
    const styles = useStyles(getStyles);
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [hasNoAccess, setHasNoAccess] = useState(false);
    useEffect(() => {
        const getSettings = () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            setLoadingSettings(true);
            try {
                const settings = yield SettingsService.getSettings(undefined, true);
                onSettingsLoadSuccess && onSettingsLoadSuccess(settings);
            }
            catch (e) {
                // @ts-ignore
                if (((_a = e.response) === null || _a === void 0 ? void 0 : _a.status) === 401) {
                    setHasNoAccess(true);
                }
                onSettingsLoadError && onSettingsLoadError();
                logger.error(e);
            }
            setLoadingSettings(false);
        });
        getSettings();
    }, [onSettingsLoadError, onSettingsLoadSuccess]);
    if (!loadingSettings && !hasNoAccess) {
        return React.createElement(React.Fragment, null, children);
    }
    return (React.createElement("div", { className: styles.emptyBlock },
        React.createElement(EmptyBlock, { dataTestId: "empty-block" }, loadingSettings ? React.createElement(Spinner, null) : hasNoAccess && React.createElement("div", { "data-testid": "unauthorized" }, Messages.unauthorized))));
};
//# sourceMappingURL=CheckPermissions.js.map