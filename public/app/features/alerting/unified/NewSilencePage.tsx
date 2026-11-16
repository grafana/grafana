import { skipToken } from '@reduxjs/toolkit/query';
import { useLocation } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { alertRuleApi } from 'app/features/alerting/unified/api/alertRuleApi';
import {
  defaultsFromQuery,
  getDefaultSilenceFormValues,
} from 'app/features/alerting/unified/components/silences/utils';
import { MATCHER_ALERT_RULE_UID } from 'app/features/alerting/unified/utils/constants';
import { parseQueryParamMatchers } from 'app/features/alerting/unified/utils/matchers';
import { AccessControlAction } from 'app/types/accessControl';

import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';
import { GrafanaAlertmanagerWarning } from './components/GrafanaAlertmanagerWarning';
import { SilencesEditor } from './components/silences/SilencesEditor';
import { hasAnyPermission, isLoading } from './hooks/abilities/abilityUtils';
import { useSilenceAbility } from './hooks/abilities/alertmanager/useSilenceAbility';
import { SilenceAction } from './hooks/abilities/types';
import { useAlertmanager } from './state/AlertmanagerContext';
import { withPageErrorBoundary } from './withPageErrorBoundary';

const SilencesEditorComponent = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const { selectedAlertmanager = '', isGrafanaAlertmanager } = useAlertmanager();
  const potentialAlertRuleMatcher = parseQueryParamMatchers(queryParams.getAll('matcher')).find(
    (m) => m.name === MATCHER_ALERT_RULE_UID
  );

  const potentialRuleUid = potentialAlertRuleMatcher?.value;
  const formValues = getDefaultSilenceFormValues(defaultsFromQuery(queryParams));

  // Users can reach this page through a link, so check up front instead of letting them fill in a
  // form that fails on save. The backend splits the check two ways: without a rule matcher this
  // form creates what it calls a general silence, which can match alerts from any rule and so
  // needs the org-wide permission. With a rule matcher the silence only affects that one rule, so
  // permission on the rule's folder is enough - which means we need to know the rule's folder.
  const isGeneralSilence = !potentialRuleUid;
  const {
    data: silencedRule,
    isLoading: silencedRuleLoading,
    isError: silencedRuleUnavailable,
  } = alertRuleApi.endpoints.getAlertRule.useQuery(
    isGeneralSilence || !isGrafanaAlertmanager ? skipToken : { uid: potentialRuleUid }
  );
  const createAbility = useSilenceAbility({
    action: SilenceAction.Create,
    folderUID: silencedRule?.grafana_alert.namespace_uid,
  });

  if (silencedRuleLoading || isLoading(createAbility)) {
    return (
      <LoadingPlaceholder text={t('alerting.new-silence-page.text-checking-permissions', 'Checking permissions...')} />
    );
  }

  if (!createAbility.granted) {
    // We never learned which folder to check, so a permission verdict isn't ours to give - the
    // folder may well allow this silence. Say what actually went wrong instead.
    if (silencedRuleUnavailable) {
      return (
        <Alert
          severity="error"
          title={t('alerting.new-silence-page.title-alert-rule-unavailable', 'Alert rule unavailable')}
        >
          <Trans i18nKey="alerting.new-silence-page.body-alert-rule-unavailable">
            This alert rule may have been deleted, or you may not have permission to view it.
          </Trans>
        </Alert>
      );
    }

    // Pointing someone at the rule detail pages is only useful if they can silence a rule there:
    // they need the folder-level permission somewhere, and those pages silence through the Grafana
    // alertmanager.
    const canSilenceSomeRule = isGrafanaAlertmanager && hasAnyPermission([AccessControlAction.AlertingSilenceCreate]);

    return (
      <Alert
        severity="error"
        title={t(
          'alerting.new-silence-page.title-permission-create-silence',
          'You do not have permission to create this silence'
        )}
      >
        {canSilenceSomeRule && (
          <Trans i18nKey="alerting.new-silence-page.body-permission-create-silence">
            You can still silence individual alert rules from their detail pages.
          </Trans>
        )}
      </Alert>
    );
  }

  return (
    <>
      <GrafanaAlertmanagerWarning currentAlertmanager={selectedAlertmanager} />
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
