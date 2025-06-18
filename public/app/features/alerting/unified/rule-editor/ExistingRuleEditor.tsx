import { NavModelItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Stack } from '@grafana/ui';
import { RuleIdentifier } from 'app/types/unified-alerting';

import { AlertWarning } from '../AlertWarning';
import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { AlertRuleForm } from '../components/rule-editor/alert-rule-form/AlertRuleForm';
import { FederatedRuleWarning } from '../components/rule-viewer/FederatedRuleWarning';
import { useRuleWithLocation } from '../hooks/useCombinedRule';
import { useIsRuleEditable } from '../hooks/useIsRuleEditable';
import { RuleFormValues } from '../types/rule-form';
import { Annotation } from '../utils/constants';
import { stringifyErrorLike } from '../utils/misc';
import { rulerRuleToFormValues } from '../utils/rule-form';
import * as ruleId from '../utils/rule-id';
import { isFederatedRuleGroup, rulerRuleType } from '../utils/rules';

import { defaultPageNav } from './RuleEditor';
import { cloneRuleDefinition } from './clone.utils';
interface ExistingRuleEditorProps {
  identifier: RuleIdentifier;
  // Provide prefill if we are trying to restore an old version of an alert rule but we need the user to manually tweak the values
  prefill?: Partial<RuleFormValues>;
  // indicate if this is a manual restore
  isManualRestore?: boolean;
  // indicate if this is a cloning operation
  clone?: boolean;
}

export function ExistingRuleEditor({
  identifier,
  prefill,
  isManualRestore = false,
  clone = false,
}: ExistingRuleEditorProps) {
  const ruleSourceName = ruleId.ruleIdentifierToRuleSourceName(identifier);
  const {
    loading: loadingAlertRule,
    result: ruleWithLocation,
    error: fetchRuleError,
  } = useRuleWithLocation({ ruleIdentifier: identifier });
  const {
    isEditable,
    loading: loadingEditable,
    error: errorEditable,
  } = useIsRuleEditable(ruleSourceName, ruleWithLocation?.rule);

  if (fetchRuleError || errorEditable) {
    return (
      <AlertingPageWrapper navId="alert-list" pageNav={getPageNav()}>
        <Alert
          severity="error"
          title={t('alerting.existing-rule-editor.title-failed-to-load-rule', 'Failed to load rule')}
        >
          {stringifyErrorLike(errorEditable ?? fetchRuleError)}
        </Alert>
      </AlertingPageWrapper>
    );
  }

  const loading = loadingAlertRule || loadingEditable;
  if (loading) {
    return (
      <AlertingPageWrapper navId="alert-list" pageNav={getPageNav()} isLoading={true}>
        {null}
      </AlertingPageWrapper>
    );
  }

  if (!ruleWithLocation && !loading) {
    return (
      <AlertingPageWrapper navId="alert-list" pageNav={getPageNav()}>
        <AlertWarning title={t('alerting.existing-rule-editor.title-rule-not-found', 'Rule not found')}>
          <Trans i18nKey="alerting.existing-rule-editor.sorry-this-rule-does-not-exist">
            Sorry! This rule does not exist.
          </Trans>
        </AlertWarning>
      </AlertingPageWrapper>
    );
  }

  if (isEditable === false) {
    return (
      <AlertingPageWrapper navId="alert-list" pageNav={getPageNav()}>
        <AlertWarning title={t('alerting.existing-rule-editor.title-cannot-edit-rule', 'Cannot edit rule')}>
          <Trans i18nKey="alerting.existing-rule-editor.sorry-permission">
            Sorry! You do not have permission to edit this rule.
          </Trans>
        </AlertWarning>
      </AlertingPageWrapper>
    );
  }

  // we shouldn't get here because loading / error handling happens before this
  if (!ruleWithLocation) {
    return null;
  }

  const rulerRule = ruleWithLocation.rule;
  const summary = rulerRuleType.any.alertingRule(rulerRule) ? rulerRule.annotations?.[Annotation.summary] : null;

  const isFederatedRule = isFederatedRuleGroup(ruleWithLocation.group);
  const isRecordingRule = rulerRuleType.any.recordingRule(rulerRule);

  const pageTitle = isRecordingRule
    ? t('alerting.editor.edit-recording-rule', 'Edit recording rule')
    : t('alerting.editor.edit-alert-rule', 'Edit alert rule');

  return (
    <AlertingPageWrapper
      navId="alert-list"
      subTitle={
        <Stack direction="column">
          {summary}
          {/* alerts and notifications and stuff */}
          {isFederatedRule && <FederatedRuleWarning />}
        </Stack>
      }
      pageNav={getPageNav({ text: pageTitle })}
    >
      {clone ? (
        <AlertRuleForm prefill={rulerRuleToFormValues(cloneRuleDefinition(ruleWithLocation))} />
      ) : (
        <AlertRuleForm existing={ruleWithLocation} prefill={prefill} isManualRestore={isManualRestore} />
      )}
    </AlertingPageWrapper>
  );
}

const getPageNav = (pageNavOptions?: Partial<NavModelItem>): NavModelItem => {
  return { ...defaultPageNav, id: 'alert-rule-edit', text: '', ...pageNavOptions };
};
