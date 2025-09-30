//
import { Trans, t } from '@grafana/i18n';
import { Stack, Text, useStyles2 } from '@grafana/ui';

import { RuleFormType } from '../../../../types/rule-form';
import { NeedHelpInfo } from '../../NeedHelpInfo';

import { getSimplifiedSectionStyles } from './sectionStyles';

export function EvaluationAndRecipientSection({ type }: { type: RuleFormType }) {
  const base = useStyles2(getSimplifiedSectionStyles);
  return (
    <div className={base.section}>
      <div className={base.sectionHeaderRow}>
        <span className={base.stepBadge}>
          <Trans i18nKey="alerting.simplified.step-number-three">3</Trans>
        </span>
        <div className={base.sectionHeader}>
          <Trans i18nKey="alerting.simplified.evaluation-and-recipient">Evaluation and Recipient</Trans>
        </div>
      </div>

      <div className={base.contentIndented}>
        <Stack direction="column">
          <Stack direction="row" gap={0.5} alignItems="center">
            <Text variant="bodySmall" color="secondary">
              <Trans i18nKey="alerting.simplified.evaluation-and-recipient.help-text">
                Define how the alert rule is evaluated.
              </Trans>
            </Text>
            <NeedHelpInfo
              contentText={
                <>
                  <p>
                    <Trans i18nKey="alerting.rule-form.evaluation-behaviour-description1">
                      Evaluation groups are containers for evaluating alert and recording rules.
                    </Trans>
                  </p>
                  <p>
                    <Trans i18nKey="alerting.rule-form.evaluation-behaviour-description2">
                      An evaluation group defines an evaluation interval - how often a rule is evaluated. Alert rules
                      within the same evaluation group are evaluated over the same evaluation interval.
                    </Trans>
                  </p>
                  <p>
                    <Trans i18nKey="alerting.rule-form.evaluation-behaviour-description3">
                      Pending period specifies how long the threshold condition must be met before the alert starts
                      firing. This option helps prevent alerts from being triggered by temporary issues.
                    </Trans>
                  </p>
                </>
              }
              externalLink="https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/rule-evaluation/"
              linkText={t(
                'alerting.rule-form.evaluation-behaviour.info-help2.link-text',
                `Read about evaluation and alert states`
              )}
              title={t('alerting.rule-form.evaluation-behaviour.info-help2.link-title', 'Alert rule evaluation')}
            />
          </Stack>
        </Stack>
      </div>
    </div>
  );
}

// no local styles currently
