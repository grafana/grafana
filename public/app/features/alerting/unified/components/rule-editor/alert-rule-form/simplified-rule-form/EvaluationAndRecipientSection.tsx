//
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';

import type { SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Field, Icon, Input, Select, Stack, Text, useStyles2 } from '@grafana/ui';

import { RuleFormType, RuleFormValues } from '../../../../types/rule-form';
import { safeParsePrometheusDuration } from '../../../../utils/time';
import { getPendingPeriodQuickOptions } from '../../DurationQuickPick';
import { NeedHelpInfo } from '../../NeedHelpInfo';
import { ContactPointSelector } from '../simplifiedRouting/contactPoint/ContactPointSelector';

import { getSimplifiedSectionStyles } from './sectionStyles';

export function EvaluationAndRecipientSection({ type }: { type: RuleFormType }) {
  const base = useStyles2(getSimplifiedSectionStyles);
  const { register, watch, setValue } = useFormContext<RuleFormValues>();
  const evaluateEvery = watch('evaluateEvery') || '5m';
  const evaluateFor = watch('evaluateFor') || '0s';
  const pendingOptions = getPendingPeriodQuickOptions(evaluateEvery);
  const [customMode, setCustomMode] = useState(false);
  const isCustomSelected = customMode;
  const customDelay = isCustomSelected ? evaluateFor : '';
  const evalMs = safeParsePrometheusDuration(evaluateEvery);
  const customMs = safeParsePrometheusDuration(customDelay || '0s');
  const isCustomInvalid = isCustomSelected && (evalMs <= 0 || customMs <= 0 || customMs % evalMs !== 0);

  // Compute label for the "Fire the alert rule" select without nested ternaries
  let fireSelectLabel: string = evaluateFor;
  if (isCustomSelected) {
    fireSelectLabel = customDelay || pendingOptions[1] || '1m';
  } else if (evaluateFor === '0s') {
    fireSelectLabel = t('alerting.duration.immediately', 'immediately');
  }
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
        <Stack direction="column" gap={2}>
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

          <div className={base.paragraphRow}>
            <Text>
              <Trans i18nKey="alerting.simplified.evaluation.every">Evaluate the rule every</Trans>
            </Text>
            <Input width={8} {...register('evaluateEvery')} />
            <Text>.</Text>
            <Text>
              <Trans i18nKey="alerting.simplified.evaluation.wait-prefix">Wait</Trans>
            </Text>
            <Input width={8} value={evaluateFor} onChange={(e) => setValue('evaluateFor', e.currentTarget.value)} />
            {isCustomSelected && (
              <Field
                noMargin
                className={base.inlineField}
                invalid={isCustomInvalid || undefined}
                error={
                  isCustomInvalid
                    ? t(
                        'alerting.simplified.evaluation.custom-delay-invalid',
                        'The delay must be a multiple of the evaluation frequency.'
                      )
                    : undefined
                }
              >
                <Input width={8} value={customDelay} onChange={(e) => setValue('evaluateFor', e.currentTarget.value)} />
              </Field>
            )}
            <Text>
              <Trans i18nKey="alerting.simplified.evaluation.wait-suffix">
                after the condition is breached before firing.
              </Trans>
            </Text>
            <Text>
              <Trans i18nKey="alerting.simplified.evaluation.fire">Fire the alert rule</Trans>
            </Text>
            <Select
              width={20}
              value={{
                value: isCustomSelected ? 'custom' : evaluateFor,
                label: fireSelectLabel,
              }}
              onChange={(v: SelectableValue<string>) => {
                const val = v?.value;
                if (val === 'custom') {
                  setCustomMode(true);
                  const defCustom = pendingOptions[1] || evaluateEvery || '1m';
                  if (!evaluateFor || pendingOptions.includes(evaluateFor)) {
                    setValue('evaluateFor', defCustom);
                  }
                  return;
                }
                setCustomMode(false);
                setValue('evaluateFor', val || '0s');
              }}
              options={[
                { value: '0s', label: t('alerting.duration.immediately', 'immediately') },
                ...pendingOptions.filter((d) => d !== '0s').map((d) => ({ value: d, label: d })),
                { value: 'custom', label: t('alerting.simplified.evaluation.custom-delay', 'with custom delay of') },
              ]}
            />
            <Text>
              <Trans i18nKey="alerting.simplified.evaluation.after-breached">
                after the condition is initially breached.
              </Trans>
            </Text>
          </div>

          <Stack direction="column" gap={1}>
            <ContactPointSelector alertManager={t('alerting.contact-point-selector.alertmanager', 'grafana')} />
          </Stack>

          {evaluateFor === '0s' && (
            <Stack direction="row" gap={0.5} alignItems="center">
              <Icon name="exclamation-triangle" />
              <Text variant="bodySmall" color="secondary">
                <Trans i18nKey="alerting.simplified.evaluation.immediate-warning">
                  Immediate firing might lead to unnecessary alerts being sent for temporary issues
                </Trans>
              </Text>
            </Stack>
          )}
        </Stack>
      </div>
    </div>
  );
}

// no local styles currently
