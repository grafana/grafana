import { useLocation } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';
import {
  defaultsFromQuery,
  getDefaultSilenceFormValues,
} from 'app/features/alerting/unified/components/silences/utils';
import { MATCHER_ALERT_RULE_UID } from 'app/features/alerting/unified/utils/constants';
import { parseQueryParamMatchers } from 'app/features/alerting/unified/utils/matchers';

import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';
import { GrafanaAlertmanagerDeliveryWarning } from './components/GrafanaAlertmanagerDeliveryWarning';
import { SilencesEditor } from './components/silences/SilencesEditor';
import { useAlertmanager } from './state/AlertmanagerContext';
import { withPageErrorBoundary } from './withPageErrorBoundary';

const SilencesEditorComponent = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const { selectedAlertmanager = '' } = useAlertmanager();
  const potentialAlertRuleMatcher = parseQueryParamMatchers(queryParams.getAll('matcher')).find(
    (m) => m.name === MATCHER_ALERT_RULE_UID
  );

  const potentialRuleUid = potentialAlertRuleMatcher?.value;
  const formValues = getDefaultSilenceFormValues(defaultsFromQuery(queryParams));

  return (
    <>
      <GrafanaAlertmanagerDeliveryWarning currentAlertmanager={selectedAlertmanager} />
      <SilencesEditor
        formValues={formValues}
        alertManagerSourceName={selectedAlertmanager}
        ruleUid={potentialRuleUid}
      />
    </>
  );
};

function NewSilencePage() {
  const pageNav = {
    id: 'silence-new',
    text: t('alerting.new-silence-page.page-nav.text.silence-alert-rule', 'Silence alert rule'),
    subTitle: t(
      'alerting.new-silence-page.page-nav.subTitle.configure-silences-notifications-particular-alert',
      'Configure silences to stop notifications from a particular alert rule'
    ),
  };
  return (
    <AlertmanagerPageWrapper navId="silences" pageNav={pageNav} accessType="instance">
      <SilencesEditorComponent />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(NewSilencePage);
