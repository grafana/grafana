import React, { useMemo } from 'react';

import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { RuleIdentifier, RuleWithLocation } from 'app/types/unified-alerting';

import { RulerRuleDTO } from '../../../types/unified-alerting-dto';

import { AlertWarning } from './AlertWarning';
import { AlertRuleForm } from './components/rule-editor/alert-rule-form/AlertRuleForm';
import { useCombinedRule } from './hooks/useCombinedRule';
import { useIsRuleEditable } from './hooks/useIsRuleEditable';
import { stringifyErrorLike } from './utils/misc';
import * as ruleId from './utils/rule-id';

interface ExistingRuleEditorProps {
  identifier: RuleIdentifier;
  id?: string;
}

export function ExistingRuleEditor({ identifier, id }: ExistingRuleEditorProps) {
  const { loading: loadingAlertRule, result, error } = useCombinedRule({ ruleIdentifier: identifier });

  const ruleWithLocation = useMemo<RuleWithLocation<RulerRuleDTO> | undefined>(() => {
    if (!result || !result.rulerRule) {
      return undefined;
    }

    // TODO Try to find a better way than going back from combined rule to ruler rule
    return {
      ruleSourceName: identifier.ruleSourceName,
      group: {
        ...result.group,
        rules: result.group.rules.map((r) => r.rulerRule).filter((rr): rr is RulerRuleDTO => rr !== undefined),
      },
      namespace: result.namespace.name,
      namespace_uid: result.namespace.uid,
      rule: result.rulerRule,
    };
  }, [result, identifier]);

  const { isEditable, loading: loadingEditable } = useIsRuleEditable(
    ruleId.ruleIdentifierToRuleSourceName(identifier),
    result?.rulerRule
  );

  const loading = loadingAlertRule || loadingEditable;

  if (loading || isEditable === undefined) {
    return <LoadingPlaceholder text="Loading rule..." />;
  }

  if (error) {
    return (
      <Alert severity="error" title="Failed to load rule">
        {stringifyErrorLike(error)}
      </Alert>
    );
  }

  if (!ruleWithLocation) {
    return <AlertWarning title="Rule not found">Sorry! This rule does not exist.</AlertWarning>;
  }

  if (isEditable === false) {
    return <AlertWarning title="Cannot edit rule">Sorry! You do not have permission to edit this rule.</AlertWarning>;
  }

  return <AlertRuleForm existing={ruleWithLocation} />;
}
