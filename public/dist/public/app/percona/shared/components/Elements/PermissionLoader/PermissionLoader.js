import React from 'react';
import { Spinner, useStyles } from '@grafana/ui';
import { getPerconaSettings } from 'app/percona/shared/core/selectors';
import { useSelector } from 'app/types';
import { EmptyBlock } from '../EmptyBlock';
import { getStyles } from './PermissionLoader.styles';
export const PermissionLoader = ({ featureSelector, renderSuccess, renderError }) => {
    const styles = useStyles(getStyles);
    const featureEnabled = useSelector(featureSelector);
    const { loading } = useSelector(getPerconaSettings);
    if (loading) {
        return React.createElement(Spinner, null);
    }
    if (featureEnabled) {
        return React.createElement(React.Fragment, null, renderSuccess());
    }
    return (React.createElement("div", { className: styles.emptyBlock },
        React.createElement(EmptyBlock, { dataTestId: "empty-block" }, renderError())));
};
//# sourceMappingURL=PermissionLoader.js.map