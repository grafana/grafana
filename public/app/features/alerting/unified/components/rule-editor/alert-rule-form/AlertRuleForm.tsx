import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';
import { FormProvider, SubmitErrorHandler, UseFormWatch, useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';

import { GrafanaTheme2 } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { Button, ConfirmModal, CustomScrollbar, Spinner, Stack, useStyles2 } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { useAppNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/core';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import InfoPausedRule from 'app/features/alerting/unified/components/InfoPausedRule';
import {
  getRuleGroupLocationFromFormValues,
  getRuleGroupLocationFromRuleWithLocation,
  isCloudRulerRule,
  isGrafanaManagedRuleByType,
  isGrafanaRulerRule,
  isGrafanaRulerRulePaused,
  isRecordingRuleByType,
} from 'app/features/alerting/unified/utils/rules';
import { RuleWithLocation } from 'app/types/unified-alerting';

import {
  LogMessages,
  logInfo,
  trackAlertRuleFormCancelled,
  trackAlertRuleFormError,
  trackAlertRuleFormSaved,
} from '../../../Analytics';
import { useDeleteRuleFromGroup } from '../../../hooks/ruleGroup/useDeleteRuleFromGroup';
import { useAddRuleToRuleGroup, useUpdateRuleInRuleGroup } from '../../../hooks/ruleGroup/useUpsertRuleFromRuleGroup';
import { RuleFormType, RuleFormValues } from '../../../types/rule-form';
import {
  DEFAULT_GROUP_EVALUATION_INTERVAL,
  MANUAL_ROUTING_KEY,
  formValuesFromExistingRule,
  getDefaultFormValues,
  getDefaultQueries,
  ignoreHiddenQueries,
  normalizeDefaultAnnotations,
  formValuesToRulerGrafanaRuleDTO,
  formValuesToRulerRuleDTO,
} from '../../../utils/rule-form';
import { fromRulerRule, fromRulerRuleAndRuleGroupIdentifier, stringifyIdentifier } from '../../../utils/rule-id';
import { GrafanaRuleExporter } from '../../export/GrafanaRuleExporter';
import { AlertRuleNameAndMetric } from '../AlertRuleNameInput';
import AnnotationsStep from '../AnnotationsStep';
import { CloudEvaluationBehavior } from '../CloudEvaluationBehavior';
import { GrafanaEvaluationBehavior } from '../GrafanaEvaluationBehavior';
import { NotificationsStep } from '../NotificationsStep';
import { RecordingRulesNameSpaceAndGroupStep } from '../RecordingRulesNameSpaceAndGroupStep';
import { RuleInspector } from '../RuleInspector';
import { QueryAndExpressionsStep } from '../query-and-alert-condition/QueryAndExpressionsStep';
import { translateRouteParamToRuleType } from '../util';

type Props = {
  existing?: RuleWithLocation;
  prefill?: Partial<RuleFormValues>; // Existing implies we modify existing rule. Prefill only provides default form values
};

export const AlertRuleForm = ({ existing, prefill }: Props) => {
  const styles = useStyles2(getStyles);
  const notifyApp = useAppNotification();
  const [queryParams] = useQueryParams();
  const [showEditYaml, setShowEditYaml] = useState(false);
  const [evaluateEvery, setEvaluateEvery] = useState(existing?.group.interval ?? DEFAULT_GROUP_EVALUATION_INTERVAL);

  const [deleteRuleFromGroup] = useDeleteRuleFromGroup();
  const [addRuleToRuleGroup] = useAddRuleToRuleGroup();
  const [updateRuleInRuleGroup] = useUpdateRuleInRuleGroup();

  const routeParams = useParams<{ type: string; id: string }>();
  const ruleType = translateRouteParamToRuleType(routeParams.type);

  const uidFromParams = routeParams.id;

  const returnTo = !queryParams.returnTo ? '/alerting/list' : String(queryParams.returnTo);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);

  const defaultValues: RuleFormValues = useMemo(() => {
    if (existing) {
      return formValuesFromExistingRule(existing);
    }

    if (prefill) {
      return formValuesFromPrefill(prefill);
    }

    if (typeof queryParams.defaults === 'string') {
      return formValuesFromQueryParams(queryParams.defaults, ruleType);
    }

    return {
      ...getDefaultFormValues(),
      condition: 'C',
      queries: getDefaultQueries(),
      type: ruleType || RuleFormType.grafana,
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
      return;
    }

    trackAlertRuleFormSaved({ formAction: existing ? 'update' : 'create', ruleType: values.type });

    // when creating a new rule, we save the manual routing setting in local storage
    if (!existing) {
      if (values.manualRouting) {
        localStorage.setItem(MANUAL_ROUTING_KEY, 'true');
      } else {
        localStorage.setItem(MANUAL_ROUTING_KEY, 'false');
      }
    }

    const ruleDefinition = grafanaTypeRule ? formValuesToRulerGrafanaRuleDTO(values) : formValuesToRulerRuleDTO(values);

    const ruleGroupIdentifier = existing
      ? getRuleGroupLocationFromRuleWithLocation(existing)
      : getRuleGroupLocationFromFormValues(values);

    // @TODO what is "evaluateEvery" being used for?
    // @TODO move this to a hook too to make sure the logic here is tested for regressions?
    if (!existing) {
      await addRuleToRuleGroup.execute(ruleGroupIdentifier, ruleDefinition, values.evaluateEvery);
    } else {
      const ruleIdentifier = fromRulerRuleAndRuleGroupIdentifier(ruleGroupIdentifier, existing.rule);
      const targetRuleGroupIdentifier = getRuleGroupLocationFromFormValues(values);

      await updateRuleInRuleGroup.execute(
        ruleGroupIdentifier,
        ruleIdentifier,
        ruleDefinition,
        targetRuleGroupIdentifier
      );
    }

    if (exitOnSave && returnTo) {
      locationService.push(returnTo);
    } else if (isCloudRulerRule(ruleDefinition)) {
      const { dataSourceName, namespaceName, groupName } = getRuleGroupLocationFromFormValues(values);
      const updatedRuleIdentifier = fromRulerRule(dataSourceName, namespaceName, groupName, ruleDefinition);
      locationService.replace(`/alerting/${encodeURIComponent(stringifyIdentifier(updatedRuleIdentifier))}/edit`);
    }
  };

  const deleteRule = async () => {
    if (existing) {
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
  };

  const evaluateEveryInForm = watch('evaluateEvery');
  useEffect(() => setEvaluateEvery(evaluateEveryInForm), [evaluateEveryInForm]);

  const actionButtons = (
    <Stack justifyContent="flex-end" alignItems="center">
      {existing && (
        <Button
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
        variant="primary"
        type="button"
        size="sm"
        onClick={handleSubmit((values) => submit(values, true), onInvalid)}
        disabled={isSubmitting}
      >
        {isSubmitting && <Spinner className={styles.buttonSpinner} inline={true} />}
        Save rule and exit
      </Button>
      <Link to={returnTo}>
        <Button variant="secondary" disabled={isSubmitting} type="button" onClick={cancelRuleCreation} size="sm">
          Cancel
        </Button>
      </Link>
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
          <CustomScrollbar autoHeightMin="100%" hideHorizontalTrack={true}>
            <Stack direction="column" gap={3}>
              {/* Step 1 */}
              <AlertRuleNameAndMetric />
              {/* Step 2 */}
              <QueryAndExpressionsStep editingExistingRule={!!existing} onDataChange={checkAlertCondition} />
              {/* Step 3-4-5 */}
              {showDataSourceDependantStep && (
                <>
                  {/* Step 3 */}
                  {isGrafanaManagedRuleByType(type) && (
                    <GrafanaEvaluationBehavior
                      evaluateEvery={evaluateEvery}
                      setEvaluateEvery={setEvaluateEvery}
                      existing={Boolean(existing)}
                      enableProvisionedGroups={false}
                    />
                  )}

                  {type === RuleFormType.cloudAlerting && <CloudEvaluationBehavior />}

                  {type === RuleFormType.cloudRecording && <RecordingRulesNameSpaceAndGroupStep />}

                  {/* Step 4 & 5 */}
                  {/* Notifications step*/}
                  <NotificationsStep alertUid={uidFromParams} />
                  {/* Annotations only for cloud and Grafana */}
                  {!isRecordingRuleByType(type) && <AnnotationsStep />}
                </>
              )}
            </Stack>
          </CustomScrollbar>
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

  return ignoreHiddenQueries({
    ...getDefaultFormValues(),
    ...ruleFromQueryParams,
    annotations: normalizeDefaultAnnotations(ruleFromQueryParams.annotations ?? []),
    queries: ruleFromQueryParams.queries ?? getDefaultQueries(),
    type: type || RuleFormType.grafana,
    evaluateEvery: DEFAULT_GROUP_EVALUATION_INTERVAL,
  });
}

function formValuesFromPrefill(rule: Partial<RuleFormValues>): RuleFormValues {
  return ignoreHiddenQueries({
    ...getDefaultFormValues(),
    ...rule,
  });
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
