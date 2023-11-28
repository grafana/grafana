import React from 'react';
import { Disable, Enable } from 'react-enable';
import { withErrorBoundary } from '@grafana/ui';
import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { AlertingFeature } from './features';
const DetailViewV1 = SafeDynamicImport(() => import('./components/rule-viewer/RuleViewer.v1'));
const DetailViewV2 = SafeDynamicImport(() => import('./components/rule-viewer/v2/RuleViewer.v2'));
const RuleViewer = (props) => {
    return (React.createElement(AlertingPageWrapper, null,
        React.createElement(Enable, { feature: AlertingFeature.DetailsViewV2 },
            React.createElement(DetailViewV2, Object.assign({}, props))),
        React.createElement(Disable, { feature: AlertingFeature.DetailsViewV2 },
            React.createElement(DetailViewV1, Object.assign({}, props)))));
};
export default withErrorBoundary(RuleViewer, { style: 'page' });
//# sourceMappingURL=RuleViewer.js.map