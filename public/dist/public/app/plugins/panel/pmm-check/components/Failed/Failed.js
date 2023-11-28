import { __awaiter } from "tslib";
import { cx } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';
import { config } from '@grafana/runtime';
import { Spinner, Tooltip, useStyles2 } from '@grafana/ui';
import { CheckService } from 'app/percona/check/Check.service';
import { getPerconaSettings, getPerconaUser } from 'app/percona/shared/core/selectors';
import { logger } from 'app/percona/shared/helpers/logger';
import { isPmmAdmin } from 'app/percona/shared/helpers/permissions';
import { useSelector } from 'app/types';
import { PMM_DATABASE_CHECKS_PANEL_URL, PMM_SETTINGS_URL } from '../../CheckPanel.constants';
import { splitSeverities } from '../../CheckPanel.utils';
import { Messages } from './Failed.messages';
import { getStyles } from './Failed.styles';
import { TooltipText } from './TooltipText';
export const Failed = () => {
    const [failedChecks, setFailedChecks] = useState([]);
    const { isAuthorized } = useSelector(getPerconaUser);
    const { result: settings, loading: settingsLoading } = useSelector(getPerconaSettings);
    const styles = useStyles2(getStyles);
    const counts = splitSeverities(failedChecks);
    const { emergency, critical, alert, error, warning, debug, info, notice } = counts;
    const sum = emergency + critical + alert + error + warning + debug + info + notice;
    const fetchAlerts = useCallback(() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const checks = yield CheckService.getAllFailedChecks(undefined, true);
            setFailedChecks(checks);
        }
        catch (e) {
            logger.error(e);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []);
    useEffect(() => {
        if (isPmmAdmin(config.bootData.user)) {
            fetchAlerts();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (settingsLoading) {
        return React.createElement(Spinner, null);
    }
    if (!isAuthorized) {
        return (React.createElement("div", { className: styles.Empty, "data-testid": "unauthorized" }, Messages.insufficientPermissions));
    }
    if (!(settings === null || settings === void 0 ? void 0 : settings.sttEnabled)) {
        return (React.createElement("div", { className: styles.Empty, "data-testid": "db-check-panel-settings-link" },
            Messages.featureDisabled,
            React.createElement("br", null),
            Messages.check,
            React.createElement("a", { className: styles.Link, href: PMM_SETTINGS_URL }, Messages.pmmSettings)));
    }
    if (!sum) {
        return (React.createElement("div", { "data-testid": "db-check-panel-zero-checks" },
            React.createElement("span", { className: cx(styles.FailedDiv, styles.Green) }, sum)));
    }
    return (React.createElement("div", { "data-testid": "db-check-panel-has-checks" },
        React.createElement(Tooltip, { placement: "top", interactive: true, content: React.createElement(TooltipText, { counts: counts }) },
            React.createElement("a", { href: PMM_DATABASE_CHECKS_PANEL_URL, className: styles.FailedDiv },
                React.createElement("span", { className: styles.Critical, "data-testid": "db-check-panel-critical" }, emergency + alert + critical),
                React.createElement("span", null, " / "),
                React.createElement("span", { className: styles.Error, "data-testid": "db-check-panel-error" }, error),
                React.createElement("span", null, " / "),
                React.createElement("span", { className: styles.Warning, "data-testid": "db-check-panel-warning" }, warning),
                React.createElement("span", null, " / "),
                React.createElement("span", { className: styles.Notice, "data-testid": "db-check-panel-notice" }, notice + info + debug)))));
};
//# sourceMappingURL=Failed.js.map