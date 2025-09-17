import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider, SubmitErrorHandler, UseFormWatch, useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom-v5-compat';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, locationService } from '@grafana/runtime';
import { Alert, Button, Stack, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/core';
import InfoPausedRule from 'app/features/alerting/unified/components/InfoPausedRule';
import {
  getRuleGroupLocationFromFormValues,
  getRuleGroupLocationFromRuleWithLocation,
  isCloudAlertingRuleByType,
  isCloudRecordingRuleByType,
  isGrafanaManagedRuleByType,
  isPausedRule,
  isRecordingRuleByType,
  rulerRuleType,
} from 'app/features/alerting/unified/utils/rules';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { RuleGroupIdentifier, RuleWithLocation } from 'app/types/unified-alerting';
import { PostableRuleGrafanaRuleDTO, RulerRuleDTO } from 'app/types/unified-alerting-dto';

import {
  LogMessages,
  logInfo,
  logWarning,
  trackAlertRuleFormCancelled,
  trackAlertRuleFormError,
  trackAlertRuleFormSaved,
  trackNewGrafanaAlertRuleFormCancelled,
  trackNewGrafanaAlertRuleFormError,
  trackNewGrafanaAlertRuleFormSavedSuccess,
} from '../../../Analytics';
import {
  GrafanaGroupUpdatedResponse,
  RulerGroupUpdatedResponse,
  isGrafanaGroupUpdatedResponse,
} from '../../../api/alertRuleModel';
import { AIFeedbackButtonComponent } from '../../../enterprise-components/AI/addAIFeedbackButton';
import { useAddRuleToRuleGroup, useUpdateRuleInRuleGroup } from '../../../hooks/ruleGroup/useUpsertRuleFromRuleGroup';
import {
  defaultFormValuesForRuleType,
  formValuesFromExistingRule,
  formValuesFromPrefill,
  translateRouteParamToRuleType,
} from '../../../rule-editor/formDefaults';
import {
  areQueriesTransformableToSimpleCondition,
  isExpressionQueryInAlert,
} from '../../../rule-editor/formProcessing';
import { RuleFormType, RuleFormValues } from '../../../types/rule-form';
import { rulesNav } from '../../../utils/navigation';
import {
  MANUAL_ROUTING_KEY,
  SIMPLIFIED_QUERY_EDITOR_KEY,
  formValuesToRulerGrafanaRuleDTO,
  formValuesToRulerRuleDTO,
} from '../../../utils/rule-form';
import { fromRulerRule, fromRulerRuleAndRuleGroupIdentifier } from '../../../utils/rule-id';
import { GrafanaRuleExporter } from '../../export/GrafanaRuleExporter';
import { AlertRuleNameAndMetric } from '../AlertRuleNameInput';
import AnnotationsStep from '../AnnotationsStep';
import { CloudEvaluationBehavior } from '../CloudEvaluationBehavior';
import { GrafanaEvaluationBehaviorStep } from '../GrafanaEvaluationBehavior';
import { GrafanaFolderAndLabelsStep } from '../GrafanaFolderAndLabelsStep';
import { NotificationsStep } from '../NotificationsStep';
import { RecordingRulesNameSpaceAndGroupStep } from '../RecordingRulesNameSpaceAndGroupStep';
import { RuleInspector } from '../RuleInspector';
import { QueryAndExpressionsStep } from '../query-and-alert-condition/QueryAndExpressionsStep';

type Props = {
  existing?: RuleWithLocation;
  prefill?: Partial<RuleFormValues>; // Existing implies we modify existing rule. Prefill only provides default form values
  isManualRestore?: boolean;
};

export const AlertRuleForm = ({ existing, prefill, isManualRestore }: Props) => {
  const styles = useStyles2(getStyles);
  const notifyApp = useAppNotification();

  const routeParams = useParams<{ type: string; id: string }>();
  const uidFromParams = routeParams.id;

  const { redirectToDetailsPage } = useRedirectToDetailsPage(uidFromParams);
  const [showEditYaml, setShowEditYaml] = useState(false);

  const [addRuleToRuleGroup] = useAddRuleToRuleGroup();
  const [updateRuleInRuleGroup] = useUpdateRuleInRuleGroup();

  const ruleType = translateRouteParamToRuleType(routeParams.type);

  const defaultValues: RuleFormValues = useMemo(() => {
    // If we have an existing AND a prefill, then we're coming from the restore dialog
    // and we want to merge the two
    if (existing && prefill) {
      return { ...formValuesFromExistingRule(existing), ...formValuesFromPrefill(prefill) };
    }
    if (existing) {
      return formValuesFromExistingRule(existing);
    }

    if (prefill) {
      return formValuesFromPrefill(prefill);
    }

    return defaultFormValuesForRuleType(ruleType);
  }, [existing, prefill, ruleType]);

  const formAPI = useForm<RuleFormValues>({
    mode: 'onSubmit',
    defaultValues,
    shouldFocusError: true,
  });

  const {
    handleSubmit,
    watch,
    formState: { isSubmitting },
    trigger,
  } = formAPI;

  useEffect(() => {
    // If the user is manually restoring an old version of a rule,
    // we should trigger validation on the form so any problem areas are clearly highlighted for them to action
    if (isManualRestore) {
      trigger();
    }
  }, [isManualRestore, trigger]);
  const type = watch('type');
  const grafanaTypeRule = isGrafanaManagedRuleByType(type ?? RuleFormType.grafana);

  const dataSourceName = watch('dataSourceName');

  const showDataSourceDependantStep = Boolean(type && (isGrafanaManagedRuleByType(type) || !!dataSourceName));

  const [conditionErrorMsg, setConditionErrorMsg] = useState('');

  const checkAlertCondition = (msg = '') => {
    setConditionErrorMsg(msg);
  };

  // @todo why is error not propagated to form?
  const submit = async (values: RuleFormValues): Promise<void> => {
    const { type, evaluateEvery } = values;

    if (conditionErrorMsg !== '') {
      notifyApp.error(conditionErrorMsg);
      if (!existing && grafanaTypeRule) {
        // new Grafana-managed rule
        trackNewGrafanaAlertRuleFormError();
      }
      return;
    }

    trackAlertRuleFormSaved({ formAction: existing ? 'update' : 'create', ruleType: type });

    const ruleDefinition = grafanaTypeRule ? formValuesToRulerGrafanaRuleDTO(values) : formValuesToRulerRuleDTO(values);

    const ruleGroupIdentifier = existing
      ? getRuleGroupLocationFromRuleWithLocation(existing)
      : getRuleGroupLocationFromFormValues(values);

    const targetRuleGroupIdentifier = getRuleGroupLocationFromFormValues(values);

    let saveResult: RulerGroupUpdatedResponse;
    // @TODO move this to a hook too to make sure the logic here is tested for regressions?
    if (!existing) {
      // when creating a new rule, we save the manual routing setting , and editorSettings.simplifiedQueryEditor to the local storage
      storeInLocalStorageValues(values);
      // save the rule to the rule group
      saveResult = await addRuleToRuleGroup.execute(ruleGroupIdentifier, ruleDefinition, evaluateEvery);
      // track the new Grafana-managed rule creation in the analytics
      if (grafanaTypeRule) {
        const dataQueries = values.queries.filter((query) => !isExpressionQuery(query.model));
        const expressionQueries = values.queries.filter((query) => isExpressionQueryInAlert(query));
        trackNewGrafanaAlertRuleFormSavedSuccess({
          simplifiedQueryEditor: values.editorSettings?.simplifiedQueryEditor ?? false,
          simplifiedNotificationEditor: values.editorSettings?.simplifiedNotificationEditor ?? false,
          canBeTransformedToSimpleQuery: areQueriesTransformableToSimpleCondition(dataQueries, expressionQueries),
        });
      }
    } else {
      // when updating an existing rule
      const ruleIdentifier = fromRulerRuleAndRuleGroupIdentifier(ruleGroupIdentifier, existing.rule);
      saveResult = await updateRuleInRuleGroup.execute(
        ruleGroupIdentifier,
        ruleIdentifier,
        ruleDefinition,
        targetRuleGroupIdentifier,
        evaluateEvery
      );
    }

    redirectToDetailsPage(ruleDefinition, targetRuleGroupIdentifier, saveResult);
    return;
  };

  const onInvalid: SubmitErrorHandler<RuleFormValues> = (errors): void => {
    trackAlertRuleFormError({
      grafana_version: config.buildInfo.version,
      org_id: contextSrv.user.orgId,
      user_id: contextSrv.user.id,
      error: Object.keys(errors).toString(),
      formAction: existing ? 'update' : 'create',
    });
    notifyApp.error('There are errors in the form. Please correct them and try again!');
  };

  const cancelRuleCreation = () => {
    logInfo(LogMessages.cancelSavingAlertRule);
    trackAlertRuleFormCancelled({ formAction: existing ? 'update' : 'create' });
    if (!existing && grafanaTypeRule) {
      // new Grafana-managed rule
      trackNewGrafanaAlertRuleFormCancelled();
    }
    locationService.getHistory().goBack();
  };

  if (!type) {
    return null;
  }

  const isPaused = rulerRuleType.grafana.rule(existing?.rule) && isPausedRule(existing?.rule);

  return (
    <FormProvider {...formAPI}>
      <form onSubmit={(e) => e.preventDefault()} className={styles.form}>
        <div className={styles.contentOuter}>
          {isManualRestore && (
            <Alert
              severity="warning"
              title={t('alerting.alertVersionHistory.warning-restore-manually-title', 'Restoring rule manually')}
            >
              <Trans i18nKey="alerting.alertVersionHistory.warning-restore-manually">
                You are manually restoring an old version of this alert rule. Please review the changes carefully before
                saving the rule definition.
              </Trans>
            </Alert>
          )}
          {isPaused && <InfoPausedRule />}
          <Stack direction="column" gap={3}>
            {/* Step 1 */}
            <AlertRuleNameAndMetric />

            {/* AI Feedback: automatically shown for rules generated by AI */}
            <AIFeedbackButtonComponent origin="alert-rule" shouldShowFeedbackButton={true} useRouteDetection={true} />

            {/* Step 2 */}
            <QueryAndExpressionsStep editingExistingRule={!!existing} onDataChange={checkAlertCondition} mode="edit" />
            {/* Step 3-4-5 */}
            {showDataSourceDependantStep && (
              <>
                {/* Step 3 */}
                {isGrafanaManagedRuleByType(type) && <GrafanaFolderAndLabelsStep />}

                {isCloudAlertingRuleByType(type) && <CloudEvaluationBehavior />}

                {isCloudRecordingRuleByType(type) && <RecordingRulesNameSpaceAndGroupStep />}

                {/* Step 4 & 5 & 6*/}
                {isGrafanaManagedRuleByType(type) && (
                  <GrafanaEvaluationBehaviorStep existing={Boolean(existing)} enableProvisionedGroups={false} />
                )}
                {/* Notifications step*/}
                <NotificationsStep alertUid={uidFromParams} />
                {/* Annotations only for alerting rules */}
                {!isRecordingRuleByType(type) && <AnnotationsStep />}
              </>
            )}

            {/* actions */}
            <Stack direction="row" alignItems="center">
              <Button
                data-testid="save-rule"
                variant="primary"
                type="button"
                onClick={handleSubmit((values) => submit(values), onInvalid)}
                disabled={isSubmitting}
                icon={isSubmitting ? 'spinner' : undefined}
              >
                <Trans i18nKey="alerting.alert-rule-form.action-buttons.save">Save</Trans>
              </Button>

              <Button variant="secondary" disabled={isSubmitting} type="button" onClick={cancelRuleCreation}>
                <Trans i18nKey="alerting.common.cancel">Cancel</Trans>
              </Button>

              {existing && isCortexLokiOrRecordingRule(watch) && (
                <Button variant="secondary" type="button" onClick={() => setShowEditYaml(true)} disabled={isSubmitting}>
                  <Trans i18nKey="alerting.alert-rule-form.action-buttons.edit-yaml">Edit YAML</Trans>
                </Button>
              )}
            </Stack>
          </Stack>
        </div>
      </form>

      {showEditYaml && (
        <>
          {grafanaTypeRule && uidFromParams && (
            <GrafanaRuleExporter alertUid={uidFromParams} onClose={() => setShowEditYaml(false)} />
          )}

          {!grafanaTypeRule && <RuleInspector onClose={() => setShowEditYaml(false)} />}
        </>
      )}
    </FormProvider>
  );
};

function useRedirectToDetailsPage(existingUid?: string) {
  const notifyApp = useAppNotification();

  const redirectGrafanaRule = useCallback(
    (saveResult: GrafanaGroupUpdatedResponse) => {
      // if the response contains no created or updated rules, we'll use the existing UID.
      const newOrUpdatedRuleUid = (saveResult.created?.at(0) || saveResult.updated?.at(0)) ?? existingUid;
      if (newOrUpdatedRuleUid) {
        locationService.replace(
          rulesNav.detailsPageLink('grafana', { uid: newOrUpdatedRuleUid, ruleSourceName: 'grafana' }, undefined, {
            skipSubPath: true,
          })
        );
      } else {
        notifyApp.error(
          'Cannot navigate to the new rule details page.',
          'The rule was created but the UID is missing.'
        );
        logWarning('Cannot navigate to the new rule details page. The rule was created but the UID is missing.');
      }
    },
    [existingUid, notifyApp]
  );

  const redirectCloudRulerRule = useCallback((rule: RulerRuleDTO, groupId: RuleGroupIdentifier) => {
    const { dataSourceName, namespaceName, groupName } = groupId;
    const updatedRuleIdentifier = fromRulerRule(dataSourceName, namespaceName, groupName, rule);
    locationService.replace(
      rulesNav.detailsPageLink(updatedRuleIdentifier.ruleSourceName, updatedRuleIdentifier, undefined, {
        skipSubPath: true,
      })
    );
  }, []);

  const redirectToDetailsPage = useCallback(
    (
      rule: RulerRuleDTO | PostableRuleGrafanaRuleDTO,
      groupId: RuleGroupIdentifier,
      saveResult: RulerGroupUpdatedResponse
    ) => {
      if (isGrafanaGroupUpdatedResponse(saveResult)) {
        redirectGrafanaRule(saveResult);
        return;
      } else if (rulerRuleType.dataSource.rule(rule)) {
        redirectCloudRulerRule(rule, groupId);
        return;
      }

      logWarning(
        'Cannot navigate to the new rule details page. The response is not a GrafanaGroupUpdatedResponse and ruleDefinition is not a Cloud Ruler rule.',
        { ruleFormType: rulerRuleType.dataSource.rule(rule) ? 'datasource' : 'grafana' }
      );
    },
    [redirectGrafanaRule, redirectCloudRulerRule]
  );

  return { redirectToDetailsPage };
}

const isCortexLokiOrRecordingRule = (watch: UseFormWatch<RuleFormValues>) => {
  const [ruleType, dataSourceName] = watch(['type', 'dataSourceName']);

  return (ruleType === RuleFormType.cloudAlerting || ruleType === RuleFormType.cloudRecording) && dataSourceName !== '';
};

function storeInLocalStorageValues(values: RuleFormValues) {
  const { manualRouting, editorSettings } = values;

  if (manualRouting) {
    localStorage.setItem(MANUAL_ROUTING_KEY, 'true');
  } else {
    localStorage.setItem(MANUAL_ROUTING_KEY, 'false');
  }

  if (editorSettings) {
    if (editorSettings.simplifiedQueryEditor) {
      localStorage.setItem(SIMPLIFIED_QUERY_EDITOR_KEY, 'true');
    } else {
      localStorage.setItem(SIMPLIFIED_QUERY_EDITOR_KEY, 'false');
    }
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  form: css({
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  }),
  contentOuter: css({
    background: theme.colors.background.primary,
    overflow: 'hidden',
    maxWidth: theme.breakpoints.values.xl,
    flex: 1,
  }),
});
