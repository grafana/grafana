import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { Trans, t } from 'app/core/internationalization';
import { RuleIdentifier } from 'app/types/unified-alerting';

import { AlertWarning } from '../AlertWarning';
import { AlertRuleForm } from '../components/rule-editor/alert-rule-form/AlertRuleForm';
import { useRuleWithLocation } from '../hooks/useCombinedRule';
import { useIsRuleEditable } from '../hooks/useIsRuleEditable';
import { RuleFormValues } from '../types/rule-form';
import { stringifyErrorLike } from '../utils/misc';
import * as ruleId from '../utils/rule-id';

interface ExistingRuleEditorProps {
  identifier: RuleIdentifier;
  /** Provide prefill if we are trying to restore an old version of an alert rule but we need the user to manually tweak the values */
  prefill?: Partial<RuleFormValues>;
}

export function ExistingRuleEditor({ identifier, prefill }: ExistingRuleEditorProps) {
  const [queryParams] = useQueryParams();
  const isManualRestore = Boolean(queryParams.isManualRestore);

  const {
    loading: loadingAlertRule,
    result: ruleWithLocation,
    error: fetchRuleError,
  } = useRuleWithLocation({ ruleIdentifier: identifier });

  const ruleSourceName = ruleId.ruleIdentifierToRuleSourceName(identifier);
  const {
    isEditable,
    loading: loadingEditable,
    error: errorEditable,
  } = useIsRuleEditable(ruleSourceName, ruleWithLocation?.rule);

  // error handling for fetching rule and rule RBAC
  if (fetchRuleError || errorEditable) {
    return (
      <Alert
        severity="error"
        title={t('alerting.existing-rule-editor.title-failed-to-load-rule', 'Failed to load rule')}
      >
        {stringifyErrorLike(errorEditable ?? fetchRuleError)}
      </Alert>
    );
  }

  const loading = loadingAlertRule || loadingEditable;

  if (loading) {
    return <LoadingPlaceholder text={t('alerting.existing-rule-editor.text-loading-rule', 'Loading rule...')} />;
  }

  if (!ruleWithLocation && !loading) {
    return (
      <AlertWarning title={t('alerting.existing-rule-editor.title-rule-not-found', 'Rule not found')}>
        <Trans i18nKey="alerting.existing-rule-editor.sorry-this-rule-does-not-exist">
          Sorry! This rule does not exist.
        </Trans>
      </AlertWarning>
    );
  }

  if (isEditable === false) {
    return (
      <AlertWarning title={t('alerting.existing-rule-editor.title-cannot-edit-rule', 'Cannot edit rule')}>
        <Trans i18nKey="alerting.existing-rule-editor.sorry-permission">
          Sorry! You do not have permission to edit this rule.
        </Trans>
      </AlertWarning>
    );
  }

  return <AlertRuleForm existing={ruleWithLocation} prefill={prefill} isManualRestore={isManualRestore} />;
}
