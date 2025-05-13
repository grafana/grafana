import { forwardRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom-v5-compat';

import { Button, ConfirmModal } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
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

    return <Navigate to={`/alerting/new?` + queryParams.toString()} replace={false} />;
  }

  return (
    <ConfirmModal
      isOpen={stage === 'confirm'}
      title={t('alerting.redirect-to-clone-rule.title-copy-provisioned-alert-rule', 'Copy provisioned alert rule')}
      body={
        <div>
          <p>
            <Trans i18nKey="alerting.redirect-to-clone-rule.body-not-provisioned">
              The new rule will <strong>not</strong> be marked as a provisioned rule.
            </Trans>
          </p>
          <p>
            <Trans i18nKey="alerting.redirect-to-clone-rule.body-evaluation-group">
              You will need to set a new evaluation group for the copied rule because the original one has been
              provisioned and cannot be used for rules created in the UI.
            </Trans>
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

export const CloneRuleButton = forwardRef<HTMLButtonElement, CloneRuleButtonProps>(
  ({ text, ruleIdentifier, isProvisioned, className }, ref) => {
    const [redirectToClone, setRedirectToClone] = useState(false);

    return (
      <>
        <Button
          title={t('alerting.clone-rule-button.title-copy', 'Copy')}
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
