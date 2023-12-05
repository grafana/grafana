import React from 'react';

import { config } from '@grafana/runtime';
import { withErrorBoundary } from '@grafana/ui';
import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { AlertingPageWrapper } from './components/AlertingPageWrapper';

const DetailViewV1 = SafeDynamicImport(() => import('./components/rule-viewer/RuleViewer.v1'));
const DetailViewV2 = SafeDynamicImport(() => import('./components/rule-viewer/v2/RuleViewer.v2'));

type RuleViewerProps = GrafanaRouteComponentProps<{
  id: string;
  sourceName: string;
}>;

const newAlertDetailView = Boolean(config.featureToggles.alertingDetailsViewV2) === true;

const RuleViewer = (props: RuleViewerProps): JSX.Element => (
  <AlertingPageWrapper>
    {newAlertDetailView ? <DetailViewV2 {...props} /> : <DetailViewV1 {...props} />}
  </AlertingPageWrapper>
);

export default withErrorBoundary(RuleViewer, { style: 'page' });
