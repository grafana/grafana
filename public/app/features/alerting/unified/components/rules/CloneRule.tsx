import React, { useState } from 'react';
import { Redirect, useLocation } from 'react-router-dom';

import { Button, ConfirmModal } from '@grafana/ui';
import { RuleIdentifier } from 'app/types/unified-alerting';

import * as ruleId from '../../utils/rule-id';

interface ConfirmCloneRuleModalProps {
  identifier: RuleIdentifier;
  isProvisioned: boolean;
  redirectTo?: boolean;
  onDismiss: () => void;
}

export function RedirectToCloneRule({
  identifier,
  isProvisioned,
  redirectTo = false,
  onDismiss,
}: ConfirmCloneRuleModalProps) {
  // For provisioned rules an additional confirmation step is required
  // Users have to be aware that the cloned rule will NOT be marked as provisioned
  const location = useLocation();
  const [stage, setStage] = useState<'redirect' | 'confirm'>(isProvisioned ? 'confirm' : 'redirect');

  if (stage === 'redirect') {
    const copyFrom = ruleId.stringifyIdentifier(identifier);
    const returnTo = location.pathname + location.search;

    const queryParams = new URLSearchParams({
      copyFrom,
      returnTo: redirectTo ? returnTo : '',
    });

    return <Redirect to={`/alerting/new?` + queryParams.toString()} push />;
  }

  return (
    <ConfirmModal
      isOpen={stage === 'confirm'}
      title="Copy provisioned alert rule"
      body={
        <div>
          <p>
            The new rule will <strong>not</strong> be marked as a provisioned rule.
          </p>
          <p>
            You will need to set a new evaluation group for the copied rule because the original one has been
            provisioned and cannot be used for rules created in the UI.
          </p>
        </div>
      }
      confirmText="Copy"
      onConfirm={() => setStage('redirect')}
      onDismiss={onDismiss}
    />
  );
}

interface CloneRuleButtonProps {
  ruleIdentifier: RuleIdentifier;
  isProvisioned: boolean;
  text?: string;
  className?: string;
}

export const CloneRuleButton = React.forwardRef<HTMLButtonElement, CloneRuleButtonProps>(
  ({ text, ruleIdentifier, isProvisioned, className }, ref) => {
    const [redirectToClone, setRedirectToClone] = useState(false);

    return (
      <>
        <Button
          title="Copy"
          className={className}
          size="sm"
          key="clone"
          variant="secondary"
          icon="copy"
          onClick={() => setRedirectToClone(true)}
          ref={ref}
        >
          {text}
        </Button>

        {redirectToClone && (
          <RedirectToCloneRule
            identifier={ruleIdentifier}
            isProvisioned={isProvisioned}
            onDismiss={() => setRedirectToClone(false)}
          />
        )}
      </>
    );
  }
);

CloneRuleButton.displayName = 'CloneRuleButton';
