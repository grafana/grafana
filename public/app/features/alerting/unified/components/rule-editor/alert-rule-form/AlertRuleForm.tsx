import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider, type SubmitErrorHandler, type UseFormWatch, useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom-v5-compat';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, getBackendSrv, locationService } from '@grafana/runtime';
import { Alert, Button, Stack, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/services/context_srv';
import InfoPausedRule from 'app/features/alerting/unified/components/InfoPausedRule';
import {
  getRuleGroupLocationFromFormValues,
  getRuleGroupLocationFromRuleWithLocation,
  getRuleUID,
  isCloudAlertingRuleByType,
  isCloudRecordingRuleByType,
  isGrafanaManagedRuleByType,
  isPausedRule,
  isRecordingRuleByType,
  isUngroupedRuleGroup,
  rulerRuleType,
} from 'app/features/alerting/unified/utils/rules';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { useDispatch } from 'app/types/store';
import { type RuleGroupIdentifier, type RuleWithLocation } from 'app/types/unified-alerting';
import { type PostableRuleGrafanaRuleDTO, type RulerRuleDTO } from 'app/types/unified-alerting-dto';

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
  type GrafanaGroupUpdatedResponse,
  type RulerGroupUpdatedResponse,
  isGrafanaGroupUpdatedResponse,
} from '../../../api/alertRuleModel';
import { alertingApi } from '../../../api/alertingApi';
import { shouldUseRulesAPIV2 } from '../../../featureToggles';
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
import { RuleFormType, type RuleFormValues } from '../../../types/rule-form';
import { stringifyErrorLike } from '../../../utils/misc';
import { rulesNav } from '../../../utils/navigation';
import {
  MANUAL_ROUTING_KEY,
  SIMPLIFIED_QUERY_EDITOR_KEY,
  cleanAnnotations,
  cleanLabels,
  fixBothInstantAndRangeQuery,
  formValuesToRulerGrafanaRuleDTO,
  formValuesToRulerRuleDTO,
} from '../../../utils/rule-form';
import { fromRulerRule, fromRulerRuleAndRuleGroupIdentifier } from '../../../utils/rule-id';
import { BacktestDropdownButton } from '../../backtesting/BacktestDropdownButton';
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
  const dispatch = useDispatch();

  const routeParams = useParams<{ type: string; id: string }>();
  const uidFromParams = routeParams.id;

  const { redirectToDetailsPage, redirectToGrafanaRuleByUid } = useRedirectToDetailsPage(uidFromParams);
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

    const errorTitle = t('alerting.alert-rule-form.error-title', 'Failed to save alert rule');

    // TODO(alerting.rulesAPIV2): remove this branch once the flag is rolled out — the v2 path below covers the same flows.
    if (!shouldUseRulesAPIV2()) {
      try {
        let saveResult: RulerGroupUpdatedResponse;
        if (!existing) {
          // when creating a new rule, we save the manual routing setting and editorSettings.simplifiedQueryEditor to the local storage
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
      } catch (err) {
        notifyApp.error(errorTitle, stringifyErrorLike(err));
      }
      return;
    }

    const targetIsUngrouped = !values.group?.trim() || isUngroupedRuleGroup(values.group);

    let saveResult: RulerGroupUpdatedResponse | undefined;
    try {
      if (!existing) {
        // when creating a new rule, we save the manual routing setting and editorSettings.simplifiedQueryEditor to the local storage
        storeInLocalStorageValues(values);

        if (grafanaTypeRule && targetIsUngrouped) {
          const createdUid = await createGrafanaRuleWithoutGroup(values, isRecordingRuleByType(type));
          if (!createdUid) {
            throw new Error('The rule was created but the UID is missing.');
          }

          dispatch(alertingApi.util.invalidateTags(legacyRuleCacheTagsForUid(createdUid)));
          notifyApp.success(t('alerting.alert-rule-form.no-group-success', 'Rule added successfully'));
          redirectToGrafanaRuleByUid(createdUid);
        } else {
          // save the rule to the rule group
          saveResult = await addRuleToRuleGroup.execute(ruleGroupIdentifier, ruleDefinition, evaluateEvery);
        }

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
        if (grafanaTypeRule && targetIsUngrouped) {
          // Save an ungrouped Grafana-managed rule via the new app-platform PUT endpoint.
          // The legacy ruler API can't represent an empty/synthetic group name.
          const uid = getRuleUID(existing.rule);
          if (!uid) {
            throw new Error('Cannot update rule without a UID');
          }
          await updateGrafanaRuleWithoutGroup(values, uid, isRecordingRuleByType(type));
          dispatch(alertingApi.util.invalidateTags(legacyRuleCacheTagsForUid(uid)));
          notifyApp.success(t('alerting.rules.update-rule.success', 'Rule updated successfully'));
          redirectToGrafanaRuleByUid(uid);
          return;
        }
        const ruleIdentifier = fromRulerRuleAndRuleGroupIdentifier(ruleGroupIdentifier, existing.rule);
        saveResult = await updateRuleInRuleGroup.execute(
          ruleGroupIdentifier,
          ruleIdentifier,
          ruleDefinition,
          targetRuleGroupIdentifier,
          evaluateEvery
        );
      }

      if (saveResult) {
        redirectToDetailsPage(ruleDefinition, targetRuleGroupIdentifier, saveResult);
      }
    } catch (err) {
      notifyApp.error(errorTitle, stringifyErrorLike(err));
    }
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

              {config.featureToggles.alertingBacktesting && <BacktestDropdownButton ruleDefinition={watch()} />}
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

  const redirectToGrafanaRuleByUid = useCallback((uid: string) => {
    locationService.replace(
      rulesNav.detailsPageLink('grafana', { uid, ruleSourceName: 'grafana' }, undefined, {
        skipSubPath: true,
      })
    );
  }, []);

  const redirectGrafanaRule = useCallback(
    (saveResult: GrafanaGroupUpdatedResponse) => {
      // if the response contains no created or updated rules, we'll use the existing UID.
      const newOrUpdatedRuleUid = (saveResult.created?.at(0) || saveResult.updated?.at(0)) ?? existingUid;
      if (newOrUpdatedRuleUid) {
        redirectToGrafanaRuleByUid(newOrUpdatedRuleUid);
      } else {
        notifyApp.error(
          'Cannot navigate to the new rule details page.',
          'The rule was created but the UID is missing.'
        );
        logWarning('Cannot navigate to the new rule details page. The rule was created but the UID is missing.');
      }
    },
    [existingUid, notifyApp, redirectToGrafanaRuleByUid]
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

  return { redirectToDetailsPage, redirectToGrafanaRuleByUid };
}

const ALERT_RULE_API_VERSION = 'rules.alerting.grafana.app/v0alpha1';
const FOLDER_ANNOTATION = 'grafana.app/folder';

function buildAlertRuleResource(values: RuleFormValues): AppPlatformRuleResource {
  const folderUid = values.folder?.uid;
  if (!folderUid) {
    throw new Error('Folder UID is required to create a Grafana-managed alert rule');
  }

  if (!values.condition) {
    throw new Error('Condition is required to create a Grafana-managed alert rule');
  }

  const labels = toRecord(cleanLabels(values.labels));
  const annotations = toRecord(cleanAnnotations(values.annotations));

  return {
    apiVersion: ALERT_RULE_API_VERSION,
    kind: 'AlertRule',
    metadata: {
      annotations: {
        [FOLDER_ANNOTATION]: folderUid,
      },
      labels: {
        ...labels,
        [FOLDER_ANNOTATION]: folderUid,
      },
    },
    spec: {
      title: values.name,
      expressions: toExpressionMap(values),
      trigger: { interval: values.evaluateEvery },
      annotations,
      labels,
      noDataState: values.noDataState,
      execErrState: values.execErrState,
      for: values.evaluateFor,
      keepFiringFor: values.keepFiringFor,
      paused: Boolean(values.isPaused),
      missingSeriesEvalsToResolve: values.missingSeriesEvalsToResolve
        ? Number(values.missingSeriesEvalsToResolve)
        : undefined,
      notificationSettings: getNotificationSettings(values),
    },
  };
}

function buildRecordingRuleResource(values: RuleFormValues): AppPlatformRuleResource {
  const folderUid = values.folder?.uid;
  if (!folderUid) {
    throw new Error('Folder UID is required to create a Grafana-managed recording rule');
  }

  return {
    apiVersion: ALERT_RULE_API_VERSION,
    kind: 'RecordingRule',
    metadata: {
      annotations: {
        [FOLDER_ANNOTATION]: folderUid,
      },
      labels: {
        ...toRecord(cleanLabels(values.labels)),
        [FOLDER_ANNOTATION]: folderUid,
      },
    },
    spec: {
      title: values.name,
      metric: values.metric ?? values.name,
      targetDatasourceUID: values.targetDatasourceUid ?? '',
      trigger: { interval: values.evaluateEvery },
      paused: Boolean(values.isPaused),
      expressions: toExpressionMap(values),
      labels: toRecord(cleanLabels(values.labels)),
    },
  };
}

function toExpressionMap(values: RuleFormValues) {
  return values.queries.reduce<Record<string, AppPlatformExpression>>((acc, query) => {
    const normalizedQuery = fixBothInstantAndRangeQuery(query);
    const isSource = normalizedQuery.refId === values.condition;
    const hasRelativeTimeRange = normalizedQuery.relativeTimeRange !== undefined;
    const isExpression = isExpressionQuery(normalizedQuery.model);

    acc[normalizedQuery.refId] = {
      model: normalizedQuery.model,
      queryType: normalizedQuery.queryType || undefined,
      datasourceUID: isExpression ? undefined : normalizedQuery.datasourceUid,
      relativeTimeRange: hasRelativeTimeRange
        ? {
            from: `${normalizedQuery.relativeTimeRange!.from}s`,
            to: `${normalizedQuery.relativeTimeRange!.to}s`,
          }
        : undefined,
      source: isSource,
    };

    return acc;
  }, {});
}

async function createGrafanaRuleWithoutGroup(
  values: RuleFormValues,
  isRecordingRule: boolean
): Promise<string | undefined> {
  const namespace = config.namespace;
  const endpoint = isRecordingRule ? 'recordingrules' : 'alertrules';
  const resource = isRecordingRule ? buildRecordingRuleResource(values) : buildAlertRuleResource(values);

  const response = await getBackendSrv().post<AppPlatformRuleResponse>(
    `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/${namespace}/${endpoint}`,
    resource
  );

  return response.metadata?.name;
}

// PUT body must include metadata.name so the URL path matches the resource.
type AppPlatformPutRuleBody = AppPlatformRuleResource & { metadata: { name: string } };

// Tags from the legacy alertingApi cache that the new app-platform write paths
// don't invalidate on their own. After a create-without-group POST or replace PUT,
// dispatch invalidation for these so list, details, and group views refetch.
function legacyRuleCacheTagsForUid(uid: string) {
  return [
    'CombinedAlertRule' as const,
    'RuleNamespace' as const,
    'RuleGroup' as const,
    'GrafanaPrometheusGroups' as const,
    { type: 'GrafanaRulerRule' as const, id: uid },
    { type: 'GrafanaRulerRuleVersion' as const, id: uid },
  ];
}

async function updateGrafanaRuleWithoutGroup(
  values: RuleFormValues,
  uid: string,
  isRecordingRule: boolean
): Promise<void> {
  // Mirrors createGrafanaRuleWithoutGroup: raw HTTP avoids the generated mutation's
  // narrow body types, which reject `RuleFormValues`'s wider state-decision enum
  // values without compromising the wire shape we already build.
  const namespace = config.namespace;
  const endpoint = isRecordingRule ? 'recordingrules' : 'alertrules';
  const baseResource = isRecordingRule ? buildRecordingRuleResource(values) : buildAlertRuleResource(values);
  const body = {
    ...baseResource,
    metadata: { ...baseResource.metadata, name: uid },
  } satisfies AppPlatformPutRuleBody;

  await getBackendSrv().put(
    `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/${namespace}/${endpoint}/${uid}`,
    body
  );
}

function toRecord(items: Array<{ key: string; value: string }>): Record<string, string> {
  return items.reduce<Record<string, string>>((acc, item) => {
    acc[item.key] = item.value;
    return acc;
  }, {});
}

function getNotificationSettings(values: RuleFormValues) {
  const settings = values.contactPoints?.grafana;
  if (!values.manualRouting || !settings?.selectedContactPoint) {
    return undefined;
  }

  return {
    receiver: settings.selectedContactPoint,
    muteTimeIntervals: settings.muteTimeIntervals,
    activeTimeIntervals: settings.activeTimeIntervals,
    groupBy: settings.overrideGrouping ? settings.groupBy : undefined,
    groupWait: settings.overrideTimings ? settings.groupWaitValue : undefined,
    groupInterval: settings.overrideTimings ? settings.groupIntervalValue : undefined,
    repeatInterval: settings.overrideTimings ? settings.repeatIntervalValue : undefined,
  };
}

type AppPlatformExpression = {
  datasourceUID?: string;
  model: unknown;
  queryType?: string;
  relativeTimeRange?: {
    from: string;
    to: string;
  };
  source?: boolean;
};

type AppPlatformRuleResource = {
  apiVersion: string;
  kind: 'AlertRule' | 'RecordingRule';
  metadata: {
    name?: string;
    annotations?: Record<string, string>;
    labels?: Record<string, string>;
  };
  spec: Record<string, unknown>;
};

type AppPlatformRuleResponse = {
  metadata?: {
    name?: string;
  };
};

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
