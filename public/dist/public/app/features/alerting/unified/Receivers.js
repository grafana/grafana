import React from 'react';
import { Disable, Enable } from 'react-enable';
import { Route, Switch } from 'react-router-dom';
import { withErrorBoundary } from '@grafana/ui';
const ContactPointsV1 = SafeDynamicImport(() => import('./components/contact-points/ContactPoints.v1'));
const ContactPointsV2 = SafeDynamicImport(() => import('./components/contact-points/ContactPoints.v2'));
const EditContactPoint = SafeDynamicImport(() => import('./components/contact-points/EditContactPoint'));
const NewContactPoint = SafeDynamicImport(() => import('./components/contact-points/NewContactPoint'));
const EditMessageTemplate = SafeDynamicImport(() => import('./components/contact-points/EditMessageTemplate'));
const NewMessageTemplate = SafeDynamicImport(() => import('./components/contact-points/NewMessageTemplate'));
const GlobalConfig = SafeDynamicImport(() => import('./components/contact-points/GlobalConfig'));
const DuplicateMessageTemplate = SafeDynamicImport(() => import('./components/contact-points/DuplicateMessageTemplate'));
import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';
import { AlertingFeature } from './features';
// TODO add pagenav back in – that way we have correct breadcrumbs and page title
const ContactPoints = (props) => (React.createElement(AlertmanagerPageWrapper, { pageId: "receivers", accessType: "notification" },
    React.createElement(Enable, { feature: AlertingFeature.ContactPointsV2 },
        React.createElement(Switch, null,
            React.createElement(Route, { exact: true, path: "/alerting/notifications", component: ContactPointsV2 }),
            React.createElement(Route, { exact: true, path: "/alerting/notifications/receivers/new", component: NewContactPoint }),
            React.createElement(Route, { exact: true, path: "/alerting/notifications/receivers/:name/edit", component: EditContactPoint }),
            React.createElement(Route, { exact: true, path: "/alerting/notifications/templates/:name/edit", component: EditMessageTemplate }),
            React.createElement(Route, { exact: true, path: "/alerting/notifications/templates/new", component: NewMessageTemplate }),
            React.createElement(Route, { exact: true, path: "/alerting/notifications/templates/:name/duplicate", component: DuplicateMessageTemplate }),
            React.createElement(Route, { exact: true, path: "/alerting/notifications/global-config", component: GlobalConfig }))),
    React.createElement(Disable, { feature: AlertingFeature.ContactPointsV2 },
        React.createElement(ContactPointsV1, Object.assign({}, props)))));
export default withErrorBoundary(ContactPoints, { style: 'page' });
//# sourceMappingURL=Receivers.js.map