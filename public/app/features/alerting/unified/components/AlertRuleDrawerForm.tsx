import { css } from '@emotion/css';
import { useEffect, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Drawer, Stack, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { getMessageFromError } from 'app/core/utils/errors';
import { RuleDefinitionSection } from 'app/features/alerting/unified/components/RuleDefinitionSection';

import { isCloudGroupUpdatedResponse, isGrafanaGroupUpdatedResponse } from '../api/alertRuleModel';
import { useAddRuleToRuleGroup } from '../hooks/ruleGroup/useUpsertRuleFromRuleGroup';
import { getDefaultFormValues } from '../rule-editor/formDefaults';
import { RuleFormType, RuleFormValues } from '../types/rule-form';
import { formValuesToRulerGrafanaRuleDTO, normalizeContactPoints } from '../utils/rule-form';
import { getRuleGroupLocationFromFormValues } from '../utils/rules';

import { RuleConditionSection } from './RuleConditionSection';
import { RuleNotificationSection } from './RuleNotificationSection';

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
    methods.reset(prefill ? { ...baseDefaults, ...prefill } : baseDefaults);
  }, [prefill, methods, baseDefaults]);

  if (!isOpen) {
    return null;
  }

  const submit = async (values: RuleFormValues) => {
    try {
      // The drawer doesn't expose a group field to keep the UX simple.
      // We derive the group name from the rule name as a sensible default.
      // The 'default' fallback should rarely occur since 'name' is a required field.
      const groupName =
        values.group && values.group.trim().length > 0 ? values.group : values.name?.trim() || 'default';
      const effectiveValues: RuleFormValues = { ...values, group: groupName };

      const dto = formValuesToRulerGrafanaRuleDTO(effectiveValues);
      const groupIdentifier = getRuleGroupLocationFromFormValues(effectiveValues);
      const result = await addRuleToRuleGroup.execute(groupIdentifier, dto, effectiveValues.evaluateEvery);

      if (isGrafanaGroupUpdatedResponse(result)) {
        notifyApp.success(
          t('alerting.alert-rule-drawer.success-title', 'Alert rule created'),
          t('alerting.alert-rule-drawer.success-message', 'Your alert rule has been created successfully.')
        );
        onClose();
        return;
      }

      // This drawer only supports Grafana-managed rules, so cloud responses indicate an error
      if (isCloudGroupUpdatedResponse(result)) {
        notifyApp.error(
          t('alerting.alert-rule-drawer.error-title', 'Failed to create alert rule'),
          result.error || t('alerting.alert-rule-drawer.error-unknown', 'An unexpected error occurred.')
        );
      } else {
        // Unexpected response type - log for debugging
        console.error('Unexpected response type from addRuleToRuleGroup:', result);
        notifyApp.error(
          t('alerting.alert-rule-drawer.error-title', 'Failed to create alert rule'),
          t('alerting.alert-rule-drawer.error-unexpected', 'Received an unexpected response. Please try again.')
        );
      }
    } catch (err) {
      const errorMessage = getMessageFromError(err);
      notifyApp.error(t('alerting.alert-rule-drawer.error-title', 'Failed to create alert rule'), errorMessage);
    }
  };

  const onInvalid = () => {
    notifyApp.error(
      t('alerting.alert-rule-drawer.validation-error-title', 'Validation error'),
      t('alerting.alert-rule-drawer.validation-error-message', 'Please correct the errors in the form and try again.')
    );
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
                  methods.reset(prefill ? { ...baseDefaults, ...prefill } : baseDefaults);
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
                    onClose();
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
