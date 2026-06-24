import { css } from '@emotion/css';
import { useEffect, useRef } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Drawer, Stack, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { getMessageFromError } from 'app/core/utils/errors';
import { RuleDefinitionSection } from 'app/features/alerting/unified/components/RuleDefinitionSection';

import {
  logError,
  trackCreateRuleFromPanelDrawerClosedWithoutSaving,
  trackCreateRuleFromPanelDrawerContinueInAlertingClicked,
  trackCreateRuleFromPanelDrawerRuleCreated,
} from '../Analytics';
import { isCloudGroupUpdatedResponse, isGrafanaGroupUpdatedResponse } from '../api/alertRuleModel';
import { shouldUseRulesAPIV2 } from '../featureToggles';
import { useAddRuleToRuleGroup } from '../hooks/ruleGroup/useUpsertRuleFromRuleGroup';
import { useUpsertUngroupedGrafanaRule } from '../hooks/useUpsertUngroupedGrafanaRule';
import { getDefaultFormValues } from '../rule-editor/formDefaults';
import { RuleFormType, type RuleFormValues } from '../types/rule-form';
import { bindAlertRuleFormSubmit } from '../utils/alertAnnotationFormSubmit';
import { formValuesToRulerGrafanaRuleDTO, normalizeContactPoints } from '../utils/rule-form';
import { getRuleGroupLocationFromFormValues } from '../utils/rules';

import { RuleConditionSection } from './RuleConditionSection';
import { RuleNotificationSection } from './RuleNotificationSection';

function getDrawerDefaultValues(prefill?: Partial<RuleFormValues>): RuleFormValues {
  // The drawer never exposes a pending period input, so we pin it to 0s (immediate firing).
  // Otherwise the inherited 1m default fails validation on the edit page whenever the user
  // picks an evaluation interval longer than 1m.
  return { ...getDefaultFormValues(RuleFormType.grafana), ...prefill, evaluateFor: '0s' };
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
  const methods = useForm<RuleFormValues>({
    defaultValues: getDrawerDefaultValues(prefill),
  });
  const styles = useStyles2(getStyles);
  const [addRuleToRuleGroup] = useAddRuleToRuleGroup();
  const upsertUngroupedGrafanaRule = useUpsertUngroupedGrafanaRule();
  const notifyApp = useAppNotification();
  const ruleCreatedRef = useRef(false);
  // When rule API v2 is on, the drawer creates rules through the App Platform groupless
  // endpoint and we can drop the "derive group from rule name" fallback below.
  const useRuleAPIV2 = shouldUseRulesAPIV2();

  // Reset form and ref when drawer opens
  useEffect(() => {
    if (isOpen) {
      ruleCreatedRef.current = false;
      methods.reset(getDrawerDefaultValues(prefill));
    }
  }, [isOpen, prefill, methods]);

  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    if (!ruleCreatedRef.current) {
      trackCreateRuleFromPanelDrawerClosedWithoutSaving();
    }
    onClose();
  };

  const submit = async (values: RuleFormValues) => {
    try {
      if (useRuleAPIV2) {
        // Force ungrouped so this can't be misrouted by a stale prefill.
        await upsertUngroupedGrafanaRule({
          values: { ...values, isUngroupedRuleGroup: true },
          existingUid: undefined,
        });

        ruleCreatedRef.current = true;
        trackCreateRuleFromPanelDrawerRuleCreated();
        notifyApp.success(
          t('alerting.alert-rule-drawer.success-title', 'Alert rule created'),
          t('alerting.alert-rule-drawer.success-message', 'Your alert rule has been created successfully.')
        );
        onClose();
        return;
      }

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
        ruleCreatedRef.current = true;
        trackCreateRuleFromPanelDrawerRuleCreated();
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
        logError(new Error('Unexpected response type from addRuleToRuleGroup'), { result });
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
      onClose={handleClose}
    >
      <div className={styles.outer}>
        <FormProvider {...methods}>
          <RuleDefinitionSection />
          <div className={styles.divider} aria-hidden="true" />
          <RuleConditionSection hideEvaluationGroup={useRuleAPIV2} />
          <div className={styles.divider} aria-hidden="true" />
          <RuleNotificationSection />
          <div className={styles.footer}>
            <Stack direction="row" gap={1} alignItems="center" justifyContent="flex-end">
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  methods.reset(getDrawerDefaultValues(prefill));
                  handleClose();
                }}
              >
                {t('alerting.common.cancel', 'Cancel')}
              </Button>
              {onContinueInAlerting && (
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    trackCreateRuleFromPanelDrawerContinueInAlertingClicked();
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
                onClick={bindAlertRuleFormSubmit(
                  methods.handleSubmit,
                  methods.getValues,
                  methods.setError,
                  (values) => submit(values),
                  onInvalid
                )}
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
