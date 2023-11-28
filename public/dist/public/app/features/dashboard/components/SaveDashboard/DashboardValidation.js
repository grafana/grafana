import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React from 'react';
import { useAsync } from 'react-use';
import { Alert, useStyles2 } from '@grafana/ui';
import { backendSrv } from 'app/core/services/backend_srv';
function DashboardValidation({ dashboard }) {
    var _a;
    const styles = useStyles2(getStyles);
    const { loading, value, error } = useAsync(() => __awaiter(this, void 0, void 0, function* () {
        const saveModel = dashboard.getSaveModelCloneOld();
        const respPromise = backendSrv
            .validateDashboard(saveModel)
            // API returns schema validation errors in 4xx range, so resolve them rather than throwing
            .catch((err) => {
            if (err.status >= 500) {
                throw err;
            }
            return err.data;
        });
        return respPromise;
    }), [dashboard]);
    let alert;
    if (loading) {
        alert = React.createElement(Alert, { severity: "info", title: "Checking dashboard validity" });
    }
    else if (value) {
        if (!value.isValid) {
            alert = (React.createElement(Alert, { severity: "warning", title: "Dashboard failed schema validation" },
                React.createElement("p", null, "Validation is provided for development purposes and should be safe to ignore. If you are a Grafana developer, consider checking and updating the dashboard schema"),
                React.createElement("div", { className: styles.error }, value.message)));
        }
    }
    else {
        const errorMessage = (_a = error === null || error === void 0 ? void 0 : error.message) !== null && _a !== void 0 ? _a : 'Unknown error';
        alert = (React.createElement(Alert, { severity: "info", title: "Error checking dashboard validity" },
            React.createElement("p", { className: styles.error }, errorMessage)));
    }
    if (alert) {
        return React.createElement("div", { className: styles.root }, alert);
    }
    return null;
}
const getStyles = (theme) => ({
    root: css({
        marginTop: theme.spacing(1),
    }),
    error: css({
        fontFamily: theme.typography.fontFamilyMonospace,
        whiteSpace: 'pre-wrap',
        overflowX: 'auto',
        maxWidth: '100%',
    }),
});
export default DashboardValidation;
//# sourceMappingURL=DashboardValidation.js.map