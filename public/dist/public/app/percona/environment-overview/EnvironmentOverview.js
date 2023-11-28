import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { OldPage } from 'app/core/components/Page/Page';
import { PlatformConnectedLoader } from '../shared/components/Elements/PlatformConnectedLoader';
import { usePerconaNavModel } from '../shared/components/hooks/perconaNavModel';
import { getStyles } from './EnvironmentOverview.styles';
import Contact from './components/ContactWidget/Contact';
export const EnvironmentOverview = () => {
    const styles = useStyles2(getStyles);
    const navModel = usePerconaNavModel('environment-overview');
    return (React.createElement(OldPage, { navModel: navModel },
        React.createElement(OldPage.Contents, { dataTestId: "page-wrapper-environment-overview" },
            React.createElement(PlatformConnectedLoader, null,
                React.createElement("div", { className: styles.widgetsWrapper },
                    React.createElement(Contact, null))))));
};
export default EnvironmentOverview;
//# sourceMappingURL=EnvironmentOverview.js.map