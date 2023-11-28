import React from 'react';
import { PageToolbar, useStyles } from '@grafana/ui/src';
import { FeatureLoader } from '../../../shared/components/Elements/FeatureLoader';
import { getStyles } from './DBaaSPage.styles';
import DBaaSPageButtons from './DBaaSPageButtons/DBaaSPageButtons';
import { PageHeader } from './PageHeader/PageHeader';
export const DBaaSPage = ({ pageToolbarProps, pageName, cancelUrl, submitBtnProps, pageHeader, children, featureLoaderProps, }) => {
    const styles = useStyles(getStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement(PageToolbar, Object.assign({ className: styles.pageToolbarWrapper }, pageToolbarProps),
            React.createElement(DBaaSPageButtons, { pageName: pageName, cancelUrl: cancelUrl, submitBtnProps: submitBtnProps })),
        React.createElement(PageHeader, { header: pageHeader }),
        React.createElement(FeatureLoader, Object.assign({}, featureLoaderProps),
            React.createElement("div", { className: styles.scrollWrapper },
                React.createElement("div", { className: styles.pageContent }, children)))));
};
export default DBaaSPage;
//# sourceMappingURL=DBaaSPage.js.map