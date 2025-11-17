import { css } from '@emotion/css';
import { useEffect, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Drawer, Stack, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { getMessageFromError } from 'app/core/utils/errors';
import { RuleDefinitionSection } from 'app/features/alerting/unified/components/RuleDefinitionSection';

import { isGrafanaGroupUpdatedResponse } from '../api/alertRuleModel';
import { useAddRuleToRuleGroup } from '../hooks/ruleGroup/useUpsertRuleFromRuleGroup';
import { getDefaultFormValues } from '../rule-editor/formDefaults';
import { AlertManagerManualRouting, ContactPoint, RuleFormType, RuleFormValues } from '../types/rule-form';
import { formValuesToRulerGrafanaRuleDTO } from '../utils/rule-form';
import { getRuleGroupLocationFromFormValues } from '../utils/rules';

import { RuleConditionSection } from './RuleConditionSection';
import { RuleNotificationSection } from './RuleNotificationSection';

function normalizeContactPoints(
  contactPoints: AlertManagerManualRouting | undefined
): AlertManagerManualRouting | undefined {
  if (!contactPoints) {
    return contactPoints;
  }

  const normalized: AlertManagerManualRouting = {};

  for (const [alertManager, contactPoint] of Object.entries(contactPoints)) {
    if (contactPoint.selectedContactPoint) {
      const defaultContactPoint: ContactPoint = {
        selectedContactPoint: contactPoint.selectedContactPoint,
        overrideGrouping: contactPoint.overrideGrouping ?? false,
        groupBy: contactPoint.groupBy ?? [],
        overrideTimings: contactPoint.overrideTimings ?? false,
        groupWaitValue: contactPoint.groupWaitValue ?? '',
        groupIntervalValue: contactPoint.groupIntervalValue ?? '',
        repeatIntervalValue: contactPoint.repeatIntervalValue ?? '',
        muteTimeIntervals: contactPoint.muteTimeIntervals ?? [],
        activeTimeIntervals: contactPoint.activeTimeIntervals ?? [],
      };
      normalized[alertManager] = defaultContactPoint;
    } else {
      normalized[alertManager] = contactPoint;
    }
  }

  return normalized;
}

export interface AlertRuleDrawerFormProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  onContinueInAlerting?: (values: RuleFormValues) => void;
  prefill?: Partial<RuleFormValues>;
}

export function AlertRuleDrawerForm({
  isOpen,
  onClose,
  title,
  onContinueInAlerting,
  prefill,
}: AlertRuleDrawerFormProps) {
  const baseDefaults = useMemo(() => getDefaultFormValues(RuleFormType.grafana), []);
  const methods = useForm<RuleFormValues>({
    defaultValues: prefill ? { ...baseDefaults, ...prefill } : baseDefaults,
  });
  const styles = useStyles2(getStyles);
  const [addRuleToRuleGroup] = useAddRuleToRuleGroup();
  const notifyApp = useAppNotification();

  // Keep form in sync if prefill changes between openings
  useEffect(() => {
    if (prefill) {
      methods.reset({ ...baseDefaults, ...prefill });
    }
  }, [prefill, methods, baseDefaults]);

  if (!isOpen) {
    return null;
  }

  const submit = async (values: RuleFormValues) => {
    try {
      const groupName =
        values.group && values.group.trim().length > 0 ? values.group : values.name?.trim() || 'default';
      const effectiveValues: RuleFormValues = { ...values, group: groupName };

      const dto = formValuesToRulerGrafanaRuleDTO(effectiveValues);
      const groupIdentifier = getRuleGroupLocationFromFormValues(effectiveValues);
      const result = await addRuleToRuleGroup.execute(groupIdentifier, dto, effectiveValues.evaluateEvery);

      if (isGrafanaGroupUpdatedResponse(result)) {
        onClose();
        return;
      }

      // Check if result has an error message
      if (result && typeof result === 'object' && 'error' in result) {
        notifyApp.error('Failed to create rule', String(result.error));
      } else {
        notifyApp.error('Failed to create rule', 'Please review the form and try again.');
      }
    } catch (err) {
      const errorMessage = getMessageFromError(err);
      notifyApp.error('Failed to create rule', errorMessage);
    }
  };

  const onInvalid = () => {
    notifyApp.error('There are errors in the form. Please correct them and try again!');
  };

  return (
    <Drawer
      title={title ?? t('alerting.new-rule-from-panel-button.new-alert-rule', 'New alert rule')}
      onClose={onClose}
    >
      <div className={styles.outer}>
        <FormProvider {...methods}>
          <RuleDefinitionSection type={RuleFormType.grafana} />
          <div className={styles.divider} aria-hidden="true" />
          <RuleConditionSection />
          <div className={styles.divider} aria-hidden="true" />
          <RuleNotificationSection />
          <div className={styles.footer}>
            <Stack direction="row" gap={1} alignItems="center" justifyContent="flex-end">
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  methods.reset(getDefaultFormValues(RuleFormType.grafana));
                  onClose();
                }}
              >
                {t('alerting.common.cancel', 'Cancel')}
              </Button>
              {onContinueInAlerting && (
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    const currentValues = methods.getValues();
                    onContinueInAlerting({
                      ...currentValues,
                      contactPoints: normalizeContactPoints(currentValues.contactPoints),
                    });
                  }}
                >
                  {t('alerting.simplified.continue-in-alerting', 'Continue in Alerting')}
                </Button>
              )}
              <Button
                variant="primary"
                type="button"
                onClick={methods.handleSubmit((values) => submit(values), onInvalid)}
                disabled={methods.formState.isSubmitting}
                icon={methods.formState.isSubmitting ? 'spinner' : undefined}
              >
                {t('alerting.simplified.create', 'Create')}
              </Button>
            </Stack>
          </div>
        </FormProvider>
      </div>
    </Drawer>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    outer: css({
      paddingLeft: theme.spacing(1),
    }),
    divider: css({
      borderTop: `1px solid ${theme.colors.border.weak}`,
      margin: `${theme.spacing(3)} 0`,
      width: '100%',
    }),
    footer: css({
      marginTop: theme.spacing(3),
    }),
  };
}
