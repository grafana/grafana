import { useLocation } from 'react-router-dom-v5-compat';

import { Trans } from '@grafana/i18n';
import { TextLink } from '@grafana/ui';

import { AlertingPageWrapper } from '../../components/AlertingPageWrapper';
import { ImportWizardGate } from '../../components/import-to-gma/ImportToGMA';
import { DOCS_URL_ALERTING_MIGRATION } from '../../utils/docs';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { useSettingsPageNav } from '../navigation';

function ImportSettingsPage() {
  const { navId, pageNav } = useSettingsPageNav();
  // Finishing or cancelling the wizard navigates back to this page. Keying on the navigation starts the
  // wizard over each time, so it shows what was just staged instead of the previous run's steps.
  const { key } = useLocation();

  return (
    <AlertingPageWrapper
      navId={navId}
      pageNav={pageNav}
      subTitle={
        <Trans i18nKey="alerting.import-to-gma.info-description">
          This wizard helps you import alert rules and notification configuration from external sources to Grafana
          Alerting. For more information, refer to the{' '}
          <TextLink href={DOCS_URL_ALERTING_MIGRATION} external>
            documentation
          </TextLink>
          .
        </Trans>
      }
    >
      <ImportWizardGate key={key} />
    </AlertingPageWrapper>
  );
}

export default withPageErrorBoundary(ImportSettingsPage);
