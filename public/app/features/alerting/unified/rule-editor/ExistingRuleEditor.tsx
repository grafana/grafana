import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { RuleIdentifier } from 'app/types/unified-alerting';

import { AlertWarning } from '../AlertWarning';
import { AlertRuleForm } from '../components/rule-editor/alert-rule-form/AlertRuleForm';
import { useRuleWithLocation } from '../hooks/useCombinedRule';
import { useIsRuleEditable } from '../hooks/useIsRuleEditable';
import { stringifyErrorLike } from '../utils/misc';
import * as ruleId from '../utils/rule-id';

interface ExistingRuleEditorProps {
  identifier: RuleIdentifier;
}

export function ExistingRuleEditor({ identifier }: ExistingRuleEditorProps) {
  const {
    loading: loadingAlertRule,
    result: ruleWithLocation,
    error,
  } = useRuleWithLocation({ ruleIdentifier: identifier });

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

  return <AlertRuleForm existing={ruleWithLocation} />;
}
