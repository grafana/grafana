import { css } from '@emotion/css';
import React from 'react';
import { Spinner, useStyles2 } from '@grafana/ui/src';
import { useGetPublicDashboardQuery } from 'app/features/dashboard/api/publicDashboardApi';
import { publicDashboardPersisted } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { HorizontalGroup } from '../../../../plugins/admin/components/HorizontalGroup';
import ConfigPublicDashboard from './ConfigPublicDashboard/ConfigPublicDashboard';
import CreatePublicDashboard from './CreatePublicDashboard/CreatePublicDashboard';
const Loader = () => {
    const styles = useStyles2(getStyles);
    return (React.createElement(HorizontalGroup, { className: styles.loadingContainer },
        React.createElement(React.Fragment, null,
            "Loading configuration",
            React.createElement(Spinner, { size: 20, className: styles.spinner }))));
};
export const SharePublicDashboard = (props) => {
    const { data: publicDashboard, isLoading, isError } = useGetPublicDashboardQuery(props.dashboard.uid);
    return (React.createElement(React.Fragment, null, isLoading ? (React.createElement(Loader, null)) : !publicDashboardPersisted(publicDashboard) ? (React.createElement(CreatePublicDashboard, { isError: isError })) : (React.createElement(ConfigPublicDashboard, null))));
};
const getStyles = (theme) => ({
    loadingContainer: css `
    height: 280px;
    align-items: center;
    justify-content: center;
    gap: ${theme.spacing(1)};
  `,
    spinner: css `
    margin-bottom: ${theme.spacing(0)};
  `,
});
//# sourceMappingURL=SharePublicDashboard.js.map