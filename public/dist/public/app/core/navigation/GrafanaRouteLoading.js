import { css } from '@emotion/css';
import React from 'react';
import { LoadingPlaceholder, useStyles2 } from '@grafana/ui';
export function GrafanaRouteLoading() {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.loadingPage },
        React.createElement(LoadingPlaceholder, { text: 'Loading...' })));
}
const getStyles = () => ({
    loadingPage: css({
        height: '100%',
        flexDrection: 'column',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    }),
});
//# sourceMappingURL=GrafanaRouteLoading.js.map