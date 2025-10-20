import { css } from '@emotion/css';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Field, Input, Stack, useStyles2 } from '@grafana/ui';

import { RuleFormType, RuleFormValues } from '../../../../types/rule-form';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../../utils/datasource';
import { isCloudRecordingRuleByType, isGrafanaManagedRuleByType, isRecordingRuleByType } from '../../../../utils/rules';
import { FolderSelector } from '../../FolderSelector';
import { LabelsEditorModal } from '../../labels/LabelsEditorModal';
import { LabelsFieldInForm } from '../../labels/LabelsFieldInForm';

export function RuleDefinitionSection({ type }: { type: RuleFormType }) {
  const styles = useStyles2(getStyles);
  const {
    register,
    formState: { errors },
    setValue,
    getValues,
  } = useFormContext<RuleFormValues>();
  const [showLabelsEditor, setShowLabelsEditor] = useState(false);

  const isRecording = isRecordingRuleByType(type);
  const isCloudRecordingRule = isCloudRecordingRuleByType(type);
  const namePlaceholder = isRecording ? 'recording rule' : 'alert rule';

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeaderRow}>
        <span className={styles.stepBadge}>
          <Trans i18nKey="alerting.simplified.step-number-one">1</Trans>
        </span>
        <div className={styles.sectionHeader}>
          <Trans i18nKey="alerting.simplified.rule-definition">Rule Definition</Trans>
        </div>
      </div>
      <div className={styles.contentIndented}>
        <Stack direction="column" gap={2}>
          <Field
            noMargin
            label={<Trans i18nKey="alerting.alert-rule-name-and-metric.label-name">Name</Trans>}
            error={errors?.name?.message}
            invalid={!!errors.name?.message}
          >
            <Input
              data-testid={selectors.components.AlertRules.ruleNameField}
              id="name"
              width={38}
              {...register('name', {
                required: {
                  value: true,
                  message: t('alerting.alert-rule-name-and-metric.message.must-enter-a-name', 'Must enter a name'),
                },
                pattern: isCloudRecordingRule
                  ? {
                      value: /^[a-zA-Z_:][a-zA-Z0-9_:]*$/,
                      message: t(
                        'alerting.alert-rule-name-and-metric.recording-rule-pattern',
                        'Recording rule name must be valid metric name. It may only contain letters, numbers, and colons. It may not contain whitespace.'
                      ),
                    }
                  : undefined,
              })}
              aria-label={t('alerting.alert-rule-name-and-metric.aria-label-name', 'name')}
              placeholder={t(
                'alerting.alert-rule-name-and-metric.placeholder-name',
                'Give your {{namePlaceholder}} a name',
                { namePlaceholder }
              )}
            />
          </Field>

          {isGrafanaManagedRuleByType(type) && (
            <>
              <FolderSelector showHelpTooltip />
              <LabelsFieldInForm showHelpTooltip onEditClick={() => setShowLabelsEditor(true)} labelVariant="small" />
              <LabelsEditorModal
                isOpen={showLabelsEditor}
                onClose={(labelsToUpdate) => {
                  if (labelsToUpdate) {
                    setValue('labels', labelsToUpdate);
                  }
                  setShowLabelsEditor(false);
                }}
                dataSourceName={GRAFANA_RULES_SOURCE_NAME}
                initialLabels={getValues('labels')}
              />
            </>
          )}
        </Stack>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    section: css({ width: '100%' }),
    sectionHeaderRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      marginBottom: theme.spacing(1),
    }),
    sectionHeader: css({
      fontWeight: 600,
      fontSize: theme.typography.h4.fontSize,
      lineHeight: theme.typography.h4.lineHeight,
    }),
    stepBadge: css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 20,
      width: 20,
      borderRadius: theme.shape.radius.circle,
      background: theme.colors.primary.main,
      color: theme.colors.text.maxContrast,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: 600,
    }),
    contentIndented: css({ marginLeft: `calc(20px + ${theme.spacing(1)})` }),
  };
}
