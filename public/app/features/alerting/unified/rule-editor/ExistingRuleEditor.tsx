import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
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
  const ruleSourceName = ruleId.ruleIdentifierToRuleSourceName(identifier);

  const {
    loading: loadingAlertRule,
    result: ruleWithLocation,
    error,
    uninitialized,
  } = useRuleWithLocation({ ruleIdentifier: identifier });

  const { isEditable, loading: loadingEditable } = useIsRuleEditable(ruleSourceName, ruleWithLocation?.rule);

  // the loading of the editable state only happens once we've got a rule with location loaded, so we set it to true by default here
  const loadingEditableState = Boolean(ruleWithLocation) ? loadingEditable : true;
  const loading = loadingAlertRule || loadingEditableState || uninitialized;
  const ruleNotFound = !Boolean(ruleWithLocation);

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

  if (ruleNotFound) {
    return <EntityNotFound entity="Rule" />;
  }

  if (isEditable === false && !loadingEditable) {
    return <AlertWarning title="Cannot edit rule">Sorry! You do not have permission to edit this rule.</AlertWarning>;
  }

  return <AlertRuleForm existing={ruleWithLocation} />;
}
