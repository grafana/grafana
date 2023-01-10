import React, { useEffect } from 'react';

import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { useDispatch } from 'app/types';
import { RuleIdentifier } from 'app/types/unified-alerting';

import { AlertWarning } from './AlertWarning';
import { AlertRuleForm } from './components/rule-editor/AlertRuleForm';
import { useIsRuleEditable } from './hooks/useIsRuleEditable';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchEditableRuleAction } from './state/actions';
import { initialAsyncRequestState } from './utils/redux';
import * as ruleId from './utils/rule-id';

interface ExistingRuleEditorProps {
  identifier: RuleIdentifier;
}

export function ExistingRuleEditor({ identifier }: ExistingRuleEditorProps) {
  useCleanup((state) => (state.unifiedAlerting.ruleForm.existingRule = initialAsyncRequestState));

  const {
    loading: loadingAlertRule,
    result,
    error,
    dispatched,
  } = useUnifiedAlertingSelector((state) => state.ruleForm.existingRule);

  const dispatch = useDispatch();
  const { isEditable, loading: loadingEditable } = useIsRuleEditable(
    ruleId.ruleIdentifierToRuleSourceName(identifier),
    result?.rule
  );

  const loading = loadingAlertRule || loadingEditable;

  useEffect(() => {
    if (!dispatched) {
      dispatch(fetchEditableRuleAction(identifier));
    }
  }, [dispatched, dispatch, identifier]);

  if (loading || isEditable === undefined) {
    return <LoadingPlaceholder text="Loading rule..." />;
  }

  if (error) {
    return (
      <Alert severity="error" title="Failed to load rule">
        {error.message}
      </Alert>
    );
  }

  if (!result) {
    return <AlertWarning title="Rule not found">Sorry! This rule does not exist.</AlertWarning>;
  }

  if (isEditable === false) {
    return <AlertWarning title="Cannot edit rule">Sorry! You do not have permission to edit this rule.</AlertWarning>;
  }

  return <AlertRuleForm existing={result} />;
}
