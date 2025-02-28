import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
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
  const {
    loading: loadingAlertRule,
    result: ruleWithLocation,
    error,
  } = useRuleWithLocation({ ruleIdentifier: identifier });
  const [queryParams] = useQueryParams();
  const isManualRestore = Boolean(queryParams.isManualRestore);

  const ruleSourceName = ruleId.ruleIdentifierToRuleSourceName(identifier);

  const { isEditable, loading: loadingEditable } = useIsRuleEditable(ruleSourceName, ruleWithLocation?.rule);

  const loading = loadingAlertRule || loadingEditable;

  if (loading) {
    return <LoadingPlaceholder text="Loading rule..." />;
  }

  if (error) {
    return (
      <Alert severity="error" title="Failed to load rule">
        {stringifyErrorLike(error)}
      </Alert>
    );
  }

  if (!ruleWithLocation && !loading) {
    return <AlertWarning title="Rule not found">Sorry! This rule does not exist.</AlertWarning>;
  }

  if (isEditable === false) {
    return <AlertWarning title="Cannot edit rule">Sorry! You do not have permission to edit this rule.</AlertWarning>;
  }

  return <AlertRuleForm existing={ruleWithLocation} prefill={prefill} isManualRestore={isManualRestore} />;
}
