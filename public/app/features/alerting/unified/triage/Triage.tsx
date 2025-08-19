import { subHours } from 'date-fns';

import { t } from '@grafana/i18n';
import { withErrorBoundary } from '@grafana/ui';

import { AlertingPageWrapper } from '../components/AlertingPageWrapper';

import { Workbench } from './Workbench';

export const TriagePage = () => {
  const domain: [Date, Date] = [subHours(new Date(), 1), new Date()];

  return (
    <AlertingPageWrapper
      navId="alerting"
      subTitle="Learn about problems in your systems moments after they occur"
      pageNav={{
        text: t('alerting.pages.triage.title', 'Triage'),
      }}
    >
      <Workbench domain={domain} />
    </AlertingPageWrapper>
  );
};

export default withErrorBoundary(TriagePage);
