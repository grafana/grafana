import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';
import { FormProvider, SubmitErrorHandler, UseFormWatch, useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom-v5-compat';

import { GrafanaTheme2 } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { Button, ConfirmModal, Spinner, Stack, useStyles2 } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { useAppNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/core';
import { Trans } from 'app/core/internationalization';
import InfoPausedRule from 'app/features/alerting/unified/components/InfoPausedRule';
import {
  getRuleGroupLocationFromFormValues,
  getRuleGroupLocationFromRuleWithLocation,
  isCloudAlertingRuleByType,
  isCloudRecordingRuleByType,
  isCloudRulerRule,
  isGrafanaManagedRuleByType,
  isGrafanaRulerRule,
  isGrafanaRulerRulePaused,
  isRecordingRuleByType,
} from 'app/features/alerting/unified/utils/rules';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { RuleGroupIdentifier, RuleIdentifier, RuleWithLocation } from 'app/types/unified-alerting';
import { PostableRuleGrafanaRuleDTO, RulerRuleDTO } from 'app/types/unified-alerting-dto';

import {
  LogMessages,
  logInfo,
  trackAlertRuleFormCancelled,
  trackAlertRuleFormError,
  trackAlertRuleFormSaved,
  trackNewGrafanaAlertRuleFormCancelled,
  trackNewGrafanaAlertRuleFormError,
  trackNewGrafanaAlertRuleFormSavedSuccess,
} from '../../../Analytics';
import { shouldUsePrometheusRulesPrimary } from '../../../featureToggles';
import { useDeleteRuleFromGroup } from '../../../hooks/ruleGroup/useDeleteRuleFromGroup';
import { useAddRuleToRuleGroup, useUpdateRuleInRuleGroup } from '../../../hooks/ruleGroup/useUpsertRuleFromRuleGroup';
import { useReturnTo } from '../../../hooks/useReturnTo';
import { useURLSearchParams } from '../../../hooks/useURLSearchParams';
import { RuleFormType, RuleFormValues } from '../../../types/rule-form';
import { DataSourceType } from '../../../utils/datasource';
import {
  DEFAULT_GROUP_EVALUATION_INTERVAL,
  MANUAL_ROUTING_KEY,
  SIMPLIFIED_QUERY_EDITOR_KEY,
  formValuesFromExistingRule,
  formValuesToRulerGrafanaRuleDTO,
  formValuesToRulerRuleDTO,
  getDefaultFormValues,
  getDefaultQueries,
  ignoreHiddenQueries,
  normalizeDefaultAnnotations,
} from '../../../utils/rule-form';
import * as ruleId from '../../../utils/rule-id';
import { fromRulerRule, fromRulerRuleAndRuleGroupIdentifier, stringifyIdentifier } from '../../../utils/rule-id';
import { isGrafanaRecordingRuleByType } from '../../../utils/rules';
import { createRelativeUrl } from '../../../utils/url';
import { GrafanaRuleExporter } from '../../export/GrafanaRuleExporter';
import { AlertRuleNameAndMetric } from '../AlertRuleNameInput';
import AnnotationsStep from '../AnnotationsStep';
import { CloudEvaluationBehavior } from '../CloudEvaluationBehavior';
import { GrafanaEvaluationBehaviorStep } from '../GrafanaEvaluationBehavior';
import { GrafanaFolderAndLabelsStep } from '../GrafanaFolderAndLabelsStep';
import { NotificationsStep } from '../NotificationsStep';
import { RecordingRulesNameSpaceAndGroupStep } from '../RecordingRulesNameSpaceAndGroupStep';
import { RuleInspector } from '../RuleInspector';
import {
  QueryAndExpressionsStep,
  areQueriesTransformableToSimpleCondition,
  isExpressionQueryInAlert,
} from '../query-and-alert-condition/QueryAndExpressionsStep';
import { translateRouteParamToRuleType } from '../util';

type Props = {
  existing?: RuleWithLocation;
  prefill?: Partial<RuleFormValues>; // Existing implies we modify existing rule. Prefill only provides default form values
};

const prometheusRulesPrimary = shouldUsePrometheusRulesPrimary();

export const AlertRuleForm = ({ existing, prefill }: Props) => {
  const styles = useStyles2(getStyles);
  const notifyApp = useAppNotification();
  const [queryParams] = useURLSearchParams();
  const [showEditYaml, setShowEditYaml] = useState(false);
  const [evaluateEvery, setEvaluateEvery] = useState(existing?.group.interval ?? DEFAULT_GROUP_EVALUATION_INTERVAL);

  const [deleteRuleFromGroup] = useDeleteRuleFromGroup();
  const [addRuleToRuleGroup] = useAddRuleToRuleGroup();
  const [updateRuleInRuleGroup] = useUpdateRuleInRuleGroup();

  const { returnTo } = useReturnTo();
  const routeParams = useParams<{ type: string; id: string }>();
  const ruleType = translateRouteParamToRuleType(routeParams.type);

  const uidFromParams = routeParams.id || '';

  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);

  const defaultValues: RuleFormValues = useMemo(() => {
    if (existing) {
      return formValuesFromExistingRule(existing);
    }

    if (prefill) {
      return formValuesFromPrefill(prefill);
    }

    if (queryParams.has('defaults')) {
      return formValuesFromQueryParams(queryParams.get('defaults') ?? '', ruleType);
    }
    const defaultRuleType = ruleType || RuleFormType.grafana;

    return {
      ...getDefaultFormValues(),
      condition: 'C',
      queries: getDefaultQueries(isGrafanaRecordingRuleByType(defaultRuleType)),
      type: defaultRuleType,
      evaluateEvery: evaluateEvery,
    };
  }, [existing, prefill, queryParams, evaluateEvery, ruleType]);

  const formAPI = useForm<RuleFormValues>({
    mode: 'onSubmit',
    defaultValues,
    shouldFocusError: true,
  });

  const {
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = formAPI;

  const type = watch('type');
  const grafanaTypeRule = isGrafanaManagedRuleByType(type ?? RuleFormType.grafana);

  const dataSourceName = watch('dataSourceName');

  const showDataSourceDependantStep = Boolean(type && (isGrafanaManagedRuleByType(type) || !!dataSourceName));

  const [conditionErrorMsg, setConditionErrorMsg] = useState('');

  const checkAlertCondition = (msg = '') => {
    setConditionErrorMsg(msg);
  };

  // @todo why is error not propagated to form?
  const submit = async (values: RuleFormValues, exitOnSave: boolean) => {
    if (conditionErrorMsg !== '') {
      notifyApp.error(conditionErrorMsg);
      if (!existing && grafanaTypeRule) {
        // new Grafana-managed rule
        trackNewGrafanaAlertRuleFormError();
      }
      return;
    }

    trackAlertRuleFormSaved({ formAction: existing ? 'update' : 'create', ruleType: values.type });

    const ruleDefinition = grafanaTypeRule ? formValuesToRulerGrafanaRuleDTO(values) : formValuesToRulerRuleDTO(values);

    const ruleGroupIdentifier = existing
      ? getRuleGroupLocationFromRuleWithLocation(existing)
      : getRuleGroupLocationFromFormValues(values);

    const targetRuleGroupIdentifier = getRuleGroupLocationFromFormValues(values);
    // @TODO move this to a hook too to make sure the logic here is tested for regressions?
    if (!existing) {
      // when creating a new rule, we save the manual routing setting , and editorSettings.simplifiedQueryEditor to the local storage
      storeInLocalStorageValues(values);
      await addRuleToRuleGroup.execute(ruleGroupIdentifier, ruleDefinition, evaluateEvery);
      grafanaTypeRule && trackNewGrafanaAlertRuleFormSavedSuccess(); // new Grafana-managed rule
    } else {
      const ruleIdentifier = fromRulerRuleAndRuleGroupIdentifier(ruleGroupIdentifier, existing.rule);
      await updateRuleInRuleGroup.execute(
        ruleGroupIdentifier,
        ruleIdentifier,
        ruleDefinition,
        targetRuleGroupIdentifier,
        evaluateEvery
      );
    }

    const { dataSourceName, namespaceName, groupName } = targetRuleGroupIdentifier;
    if (exitOnSave) {
      const returnToUrl = returnTo || getReturnToUrl(targetRuleGroupIdentifier, ruleDefinition);

      locationService.push(returnToUrl);
      return;
    } else {
      // we stay in the same page

      // Cloud Ruler rules identifier changes on update due to containing rule name and hash components
      // After successful update we need to update the URL to avoid displaying 404 errors
      if (isCloudRulerRule(ruleDefinition)) {
        const updatedRuleIdentifier = fromRulerRule(dataSourceName, namespaceName, groupName, ruleDefinition);
        locationService.replace(`/alerting/${encodeURIComponent(stringifyIdentifier(updatedRuleIdentifier))}/edit`);
      }
    }
  };

  const deleteRule = async () => {
    if (existing) {
      const returnTo = queryParams.get('returnTo') || '/alerting/list';
      const ruleGroupIdentifier = getRuleGroupLocationFromRuleWithLocation(existing);
      const ruleIdentifier = fromRulerRuleAndRuleGroupIdentifier(ruleGroupIdentifier, existing.rule);

      await deleteRuleFromGroup.execute(ruleGroupIdentifier, ruleIdentifier);
      locationService.replace(returnTo);
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

  const evaluateEveryInForm = watch('evaluateEvery');
  useEffect(() => setEvaluateEvery(evaluateEveryInForm), [evaluateEveryInForm]);

  const actionButtons = (
    <Stack justifyContent="flex-end" alignItems="center">
      {existing && (
        <Button
          data-testid="save-rule"
          variant="primary"
          type="button"
          size="sm"
          onClick={handleSubmit((values) => submit(values, false), onInvalid)}
          disabled={isSubmitting}
        >
          {isSubmitting && <Spinner className={styles.buttonSpinner} inline={true} />}
          Save rule
        </Button>
      )}
      <Button
        data-testid="save-rule-and-exit"
        variant="primary"
        type="button"
        size="sm"
        onClick={handleSubmit((values) => submit(values, true), onInvalid)}
        disabled={isSubmitting}
      >
        {isSubmitting && <Spinner className={styles.buttonSpinner} inline={true} />}
        Save rule and exit
      </Button>
      <Button variant="secondary" disabled={isSubmitting} type="button" onClick={cancelRuleCreation} size="sm">
        <Trans i18nKey="alerting.common.cancel">Cancel</Trans>
      </Button>
      {existing ? (
        <Button fill="outline" variant="destructive" type="button" onClick={() => setShowDeleteModal(true)} size="sm">
          Delete
        </Button>
      ) : null}
      {existing && isCortexLokiOrRecordingRule(watch) && (
        <Button
          variant="secondary"
          type="button"
          onClick={() => setShowEditYaml(true)}
          disabled={isSubmitting}
          size="sm"
        >
          Edit YAML
        </Button>
      )}
    </Stack>
  );

  const isPaused = existing && isGrafanaRulerRule(existing.rule) && isGrafanaRulerRulePaused(existing.rule);
  if (!type) {
    return null;
  }
  return (
    <FormProvider {...formAPI}>
      <AppChromeUpdate actions={actionButtons} />
      <form onSubmit={(e) => e.preventDefault()} className={styles.form}>
        <div className={styles.contentOuter}>
          {isPaused && <InfoPausedRule />}
          <Stack direction="column" gap={3}>
            {/* Step 1 */}
            <AlertRuleNameAndMetric />
            {/* Step 2 */}
            <QueryAndExpressionsStep editingExistingRule={!!existing} onDataChange={checkAlertCondition} />
            {/* Step 3-4-5 */}
            {showDataSourceDependantStep && (
              <>
                {/* Step 3 */}
                {isGrafanaManagedRuleByType(type) && <GrafanaFolderAndLabelsStep />}

                {isCloudAlertingRuleByType(type) && <CloudEvaluationBehavior />}

                {isCloudRecordingRuleByType(type) && <RecordingRulesNameSpaceAndGroupStep />}

                {/* Step 4 & 5 & 6*/}
                {isGrafanaManagedRuleByType(type) && (
                  <GrafanaEvaluationBehaviorStep
                    evaluateEvery={evaluateEvery}
                    setEvaluateEvery={setEvaluateEvery}
                    existing={Boolean(existing)}
                    enableProvisionedGroups={false}
                  />
                )}
                {/* Notifications step*/}
                <NotificationsStep alertUid={uidFromParams} />
                {/* Annotations only for alerting rules */}
                {!isRecordingRuleByType(type) && <AnnotationsStep />}
              </>
            )}
          </Stack>
        </div>
      </form>
      {showDeleteModal ? (
        <ConfirmModal
          isOpen={true}
          title="Delete rule"
          body="Deleting this rule will permanently remove it. Are you sure you want to delete this rule?"
          confirmText="Yes, delete"
          icon="exclamation-triangle"
          onConfirm={deleteRule}
          onDismiss={() => setShowDeleteModal(false)}
        />
      ) : null}
      {showEditYaml ? (
        isGrafanaManagedRuleByType(type) ? (
          <GrafanaRuleExporter alertUid={uidFromParams} onClose={() => setShowEditYaml(false)} />
        ) : (
          <RuleInspector onClose={() => setShowEditYaml(false)} />
        )
      ) : null}
    </FormProvider>
  );
};

function getReturnToUrl(groupId: RuleGroupIdentifier, rule: RulerRuleDTO | PostableRuleGrafanaRuleDTO) {
  const { dataSourceName, namespaceName, groupName } = groupId;

  if (prometheusRulesPrimary && isCloudRulerRule(rule)) {
    const ruleIdentifier = fromRulerRule(dataSourceName, namespaceName, groupName, rule);
    return createViewLinkFromIdentifier(ruleIdentifier);
  }

  // TODO We could add namespace and group filters but for GMA the namespace = uid which doesn't work with the filters
  return '/alerting/list';
}

// The result of this function is passed to locationService.push()
// Hence it cannot contain the subpath prefix, so we cannot use createRelativeUrl for it
function createViewLinkFromIdentifier(identifier: RuleIdentifier, returnTo?: string) {
  const paramId = encodeURIComponent(ruleId.stringifyIdentifier(identifier));
  const paramSource = encodeURIComponent(identifier.ruleSourceName);

  return createRelativeUrl(`/alerting/${paramSource}/${paramId}/view`, returnTo ? { returnTo } : {});
}

const isCortexLokiOrRecordingRule = (watch: UseFormWatch<RuleFormValues>) => {
  const [ruleType, dataSourceName] = watch(['type', 'dataSourceName']);

  return (ruleType === RuleFormType.cloudAlerting || ruleType === RuleFormType.cloudRecording) && dataSourceName !== '';
};

function formValuesFromQueryParams(ruleDefinition: string, type: RuleFormType): RuleFormValues {
  let ruleFromQueryParams: Partial<RuleFormValues>;

  try {
    ruleFromQueryParams = JSON.parse(ruleDefinition);
  } catch (err) {
    return {
      ...getDefaultFormValues(),
      queries: getDefaultQueries(),
    };
  }

  return setQueryEditorSettings(
    setInstantOrRange(
      ignoreHiddenQueries({
        ...getDefaultFormValues(),
        ...ruleFromQueryParams,
        annotations: normalizeDefaultAnnotations(ruleFromQueryParams.annotations ?? []),
        queries: ruleFromQueryParams.queries ?? getDefaultQueries(),
        type: type || RuleFormType.grafana,
        evaluateEvery: DEFAULT_GROUP_EVALUATION_INTERVAL,
      })
    )
  );
}

function formValuesFromPrefill(rule: Partial<RuleFormValues>): RuleFormValues {
  return ignoreHiddenQueries({
    ...getDefaultFormValues(),
    ...rule,
  });
}

function setQueryEditorSettings(values: RuleFormValues): RuleFormValues {
  const isQuerySwitchModeEnabled = config.featureToggles.alertingQueryAndExpressionsStepMode ?? false;

  if (!isQuerySwitchModeEnabled) {
    return {
      ...values,
      editorSettings: {
        simplifiedQueryEditor: false,
        simplifiedNotificationEditor: true, // actually it doesn't matter in this case
      },
    };
  }

  // data queries only
  const dataQueries = values.queries.filter((query) => !isExpressionQuery(query.model));

  // expression queries only
  const expressionQueries = values.queries.filter((query) => isExpressionQueryInAlert(query));

  const queryParamsAreTransformable = areQueriesTransformableToSimpleCondition(dataQueries, expressionQueries);
  return {
    ...values,
    editorSettings: {
      simplifiedQueryEditor: queryParamsAreTransformable,
      simplifiedNotificationEditor: true,
    },
  };
}

function setInstantOrRange(values: RuleFormValues): RuleFormValues {
  return {
    ...values,
    queries: values.queries?.map((query) => {
      if (isExpressionQuery(query.model)) {
        return query;
      }
      // data query
      const defaultToInstant =
        query.model.datasource?.type === DataSourceType.Loki ||
        query.model.datasource?.type === DataSourceType.Prometheus;
      const isInstant =
        'instant' in query.model && query.model.instant !== undefined ? query.model.instant : defaultToInstant;
      return {
        ...query,
        model: {
          ...query.model,
          instant: isInstant,
          range: !isInstant, // we cannot have both instant and range queries in alerting
        },
      };
    }),
  };
}

function storeInLocalStorageValues(values: RuleFormValues) {
  if (values.manualRouting) {
    localStorage.setItem(MANUAL_ROUTING_KEY, 'true');
  } else {
    localStorage.setItem(MANUAL_ROUTING_KEY, 'false');
  }
  if (values.editorSettings) {
    if (values.editorSettings.simplifiedQueryEditor) {
      localStorage.setItem(SIMPLIFIED_QUERY_EDITOR_KEY, 'true');
    } else {
      localStorage.setItem(SIMPLIFIED_QUERY_EDITOR_KEY, 'false');
    }
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  buttonSpinner: css({
    marginRight: theme.spacing(1),
  }),
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
  flexRow: css({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
  }),
});
