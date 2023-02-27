import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { ConfirmModal, LinkButton, useStyles2 } from '@grafana/ui';
import { RuleIdentifier } from 'app/types/unified-alerting';

import * as ruleId from '../../utils/rule-id';
import { createUrl } from '../../utils/url';

interface CloneRuleButtonProps {
  ruleIdentifier: RuleIdentifier;
  isProvisioned: boolean;
  text?: string;
  className?: string;
}

export const CloneRuleButton = React.forwardRef<HTMLAnchorElement, CloneRuleButtonProps>(
  ({ text, ruleIdentifier, isProvisioned, className }, ref) => {
    // For provisioned rules an additional confirmation step is required
    // Users have to be aware that the cloned rule will NOT be marked as provisioned
    const [provRuleCloneUrl, setProvRuleCloneUrl] = useState<string | undefined>(undefined);

    const styles = useStyles2(getStyles);
    const cloneUrl = createUrl('/alerting/new', { copyFrom: ruleId.stringifyIdentifier(ruleIdentifier) });

    return (
      <>
        <LinkButton
          title="Copy"
          className={className}
          size="sm"
          key="clone"
          variant="secondary"
          icon="copy"
          href={isProvisioned ? undefined : cloneUrl}
          onClick={isProvisioned ? () => setProvRuleCloneUrl(cloneUrl) : undefined}
          ref={ref}
        >
          {text}
        </LinkButton>

        <ConfirmModal
          isOpen={!!provRuleCloneUrl}
          title="Copy provisioned alert rule"
          body={
            <div>
              <p>
                The new rule will <span className={styles.bold}>NOT</span> be marked as a provisioned rule.
              </p>
              <p>
                You will need to set a new alert group for the copied rule because the original one has been provisioned
                and cannot be used for rules created in the UI.
              </p>
            </div>
          }
          confirmText="Copy"
          onConfirm={() => provRuleCloneUrl && locationService.push(provRuleCloneUrl)}
          onDismiss={() => setProvRuleCloneUrl(undefined)}
        />
      </>
    );
  }
);

CloneRuleButton.displayName = 'CloneRuleButton';

const getStyles = (theme: GrafanaTheme2) => ({
  bold: css`
    font-weight: ${theme.typography.fontWeightBold};
  `,
});
