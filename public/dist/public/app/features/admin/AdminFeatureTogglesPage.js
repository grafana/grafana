import { css } from '@emotion/css';
import React, { useState } from 'react';
import { useStyles2, Icon } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useGetFeatureTogglesQuery, useGetManagerStateQuery } from './AdminFeatureTogglesAPI';
import { AdminFeatureTogglesTable } from './AdminFeatureTogglesTable';
export default function AdminFeatureTogglesPage() {
    const { data: featureToggles, isLoading, isError } = useGetFeatureTogglesQuery();
    const { data: featureMgmtState } = useGetManagerStateQuery();
    const [updateSuccessful, setUpdateSuccessful] = useState(false);
    const styles = useStyles2(getStyles);
    const getErrorMessage = () => {
        return 'Error fetching feature toggles';
    };
    const handleUpdateSuccess = () => {
        setUpdateSuccessful(true);
    };
    const AlertMessage = () => {
        return (React.createElement("div", { className: styles.warning },
            React.createElement("div", { className: styles.icon },
                React.createElement(Icon, { name: "exclamation-triangle" })),
            React.createElement("span", { className: styles.message }, (featureMgmtState === null || featureMgmtState === void 0 ? void 0 : featureMgmtState.restartRequired) || updateSuccessful
                ? 'A restart is pending for your Grafana instance to apply the latest feature toggle changes'
                : 'Saving feature toggle changes will prompt a restart of the instance, which may take a few minutes')));
    };
    return (React.createElement(Page, { navId: "feature-toggles" },
        React.createElement(Page.Contents, null,
            React.createElement(React.Fragment, null,
                isError && getErrorMessage(),
                isLoading && 'Fetching feature toggles',
                React.createElement(AlertMessage, null),
                featureToggles && (React.createElement(AdminFeatureTogglesTable, { featureToggles: featureToggles, onUpdateSuccess: handleUpdateSuccess }))))));
}
function getStyles(theme) {
    return {
        warning: css({
            display: 'flex',
            marginTop: theme.spacing(3),
        }),
        icon: css({
            color: theme.colors.warning.main,
            paddingRight: theme.spacing(),
        }),
        message: css({
            color: theme.colors.text.secondary,
            marginTop: theme.spacing(0.25),
        }),
    };
}
//# sourceMappingURL=AdminFeatureTogglesPage.js.map