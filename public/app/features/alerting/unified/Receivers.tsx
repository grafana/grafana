import React from 'react';
import { Disable, Enable } from 'react-enable';

import { withErrorBoundary } from '@grafana/ui';
const ContactPointsV1 = SafeDynamicImport(() => import('./components/contact-points/ContactPoints.v1'));
const ContactPointsV2 = SafeDynamicImport(() => import('./components/contact-points/ContactPoints.v2'));
import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';
import { AlertingFeature } from './features';
// TODO add pagenav back in – what are we missing if we don't specify it?
const ContactPoints = (props: GrafanaRouteComponentProps): JSX.Element => (
  <AlertmanagerPageWrapper pageId="receivers" accessType="notification">
    <Enable feature={AlertingFeature.ContactPointsV2}>
      <ContactPointsV2 {...props} />
    </Enable>
    <Disable feature={AlertingFeature.ContactPointsV2}>
      <ContactPointsV1 {...props} />
    </Disable>
  </AlertmanagerPageWrapper>
);

export default withErrorBoundary(ContactPoints, { style: 'page' });
