import { css } from '@emotion/css';
import { useMemo, useState } from 'react';
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
import {
  defaultFormValuesForRuleType,
  formValuesFromExistingRule,
  formValuesFromPrefill,
  translateRouteParamToRuleType,
} from '../../../rule-editor/formDefaults';
import { RuleFormType, RuleFormValues } from '../../../types/rule-form';
import {
  MANUAL_ROUTING_KEY,
  SIMPLIFIED_QUERY_EDITOR_KEY,
  formValuesToRulerGrafanaRuleDTO,
  formValuesToRulerRuleDTO,
} from '../../../utils/rule-form';
import * as ruleId from '../../../utils/rule-id';
import { fromRulerRule, fromRulerRuleAndRuleGroupIdentifier, stringifyIdentifier } from '../../../utils/rule-id';
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
import { QueryAndExpressionsStep } from '../query-and-alert-condition/QueryAndExpressionsStep';

type Props = {
  existing?: RuleWithLocation;
  prefill?: Partial<RuleFormValues>; // Existing implies we modify existing rule. Prefill only provides default form values
};

const prometheusRulesPrimary = shouldUsePrometheusRulesPrimary();

export const AlertRuleForm = ({ existing, prefill }: Props) => {
  const styles = useStyles2(getStyles);
  const notifyApp = useAppNotification();
  const [showEditYaml, setShowEditYaml] = useState(false);

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

    const defaultRuleType = ruleType || RuleFormType.grafana;

    return defaultFormValuesForRuleType(defaultRuleType);
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
      const ruleGroupIdentifier = getRuleGroupLocationFromRuleWithLocation(existing);
      const ruleIdentifier = fromRulerRuleAndRuleGroupIdentifier(ruleGroupIdentifier, existing.rule);

      await deleteRuleFromGroup.execute(ruleGroupIdentifier, ruleIdentifier);
      locationService.replace(returnTo ?? '/alerting/list');
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
                  <GrafanaEvaluationBehaviorStep existing={Boolean(existing)} enableProvisionedGroups={false} />
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
