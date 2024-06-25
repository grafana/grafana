import { withErrorBoundary } from '@grafana/ui';

import { AlertingPageWrapper } from '../../AlertingPageWrapper';

import { CentralAlertHistoryScene } from './CentralAlertHistoryScene';

const HistoryPage = () => {
  return (
    <AlertingPageWrapper navId="alerts-history" isLoading={false}>
      <CentralAlertHistoryScene />
    </AlertingPageWrapper>
  );
};
export default withErrorBoundary(HistoryPage, { style: 'page' });
