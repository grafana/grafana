import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';
import { FormProvider, SubmitErrorHandler, UseFormWatch, useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Button, ConfirmModal, CustomScrollbar, HorizontalGroup, Spinner, Stack, useStyles2 } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { useAppNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/core';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { useDispatch } from 'app/types';
import { RuleWithLocation } from 'app/types/unified-alerting';

import { LogMessages, logInfo, trackNewAlerRuleFormError } from '../../../Analytics';
import { useUnifiedAlertingSelector } from '../../../hooks/useUnifiedAlertingSelector';
import { deleteRuleAction, saveRuleFormAction } from '../../../state/actions';
import { RuleFormType, RuleFormValues } from '../../../types/rule-form';
import { initialAsyncRequestState } from '../../../utils/redux';
import {
  MANUAL_ROUTING_KEY,
  MINUTE,
  formValuesFromExistingRule,
  getDefaultFormValues,
  getDefaultQueries,
  ignoreHiddenQueries,
  normalizeDefaultAnnotations,
} from '../../../utils/rule-form';
import * as ruleId from '../../../utils/rule-id';
import { GrafanaRuleExporter } from '../../export/GrafanaRuleExporter';
import { AlertRuleNameInput } from '../AlertRuleNameInput';
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
  const dispatch = useDispatch();
  const notifyApp = useAppNotification();
  const [queryParams] = useQueryParams();
  const [showEditYaml, setShowEditYaml] = useState(false);
  const [evaluateEvery, setEvaluateEvery] = useState(existing?.group.interval ?? MINUTE);

  const routeParams = useParams<{ type: string; id: string }>();
  const ruleType = translateRouteParamToRuleType(routeParams.type);
  const uidFromParams = routeParams.id;

  const returnTo = !queryParams['returnTo'] ? '/alerting/list' : String(queryParams['returnTo']);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);

  const defaultValues: RuleFormValues = useMemo(() => {
    if (existing) {
      return formValuesFromExistingRule(existing);
    }

    if (prefill) {
      return formValuesFromPrefill(prefill);
    }

    if (typeof queryParams['defaults'] === 'string') {
      return formValuesFromQueryParams(queryParams['defaults'], ruleType);
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

  const { handleSubmit, watch } = formAPI;

  const type = watch('type');
  const dataSourceName = watch('dataSourceName');

  const showDataSourceDependantStep = Boolean(type && (type === RuleFormType.grafana || !!dataSourceName));

  const submitState = useUnifiedAlertingSelector((state) => state.ruleForm.saveRule) || initialAsyncRequestState;
  useCleanup((state) => (state.unifiedAlerting.ruleForm.saveRule = initialAsyncRequestState));

  const [conditionErrorMsg, setConditionErrorMsg] = useState('');

  const checkAlertCondition = (msg = '') => {
    setConditionErrorMsg(msg);
  };

  const submit = (values: RuleFormValues, exitOnSave: boolean) => {
    if (conditionErrorMsg !== '') {
      notifyApp.error(conditionErrorMsg);
      return;
    }
    // when creating a new rule, we save the manual routing setting in local storage
    if (!existing) {
      if (values.manualRouting) {
        localStorage.setItem(MANUAL_ROUTING_KEY, 'true');
      } else {
        localStorage.setItem(MANUAL_ROUTING_KEY, 'false');
      }
    }

    dispatch(
      saveRuleFormAction({
        values: {
          ...defaultValues,
          ...values,
          annotations:
            values.annotations
              ?.map(({ key, value }) => ({ key: key.trim(), value: value.trim() }))
              .filter(({ key, value }) => !!key && !!value) ?? [],
          labels:
            values.labels
              ?.map(({ key, value }) => ({ key: key.trim(), value: value.trim() }))
              .filter(({ key }) => !!key) ?? [],
        },
        existing,
        redirectOnSave: exitOnSave ? returnTo : undefined,
        initialAlertRuleName: defaultValues.name,
        evaluateEvery: evaluateEvery,
      })
    );
  };

  const deleteRule = () => {
    if (existing) {
      const identifier = ruleId.fromRulerRule(
        existing.ruleSourceName,
        existing.namespace,
        existing.group.name,
        existing.rule
      );

      dispatch(deleteRuleAction(identifier, { navigateTo: '/alerting/list' }));
    }
  };

  const onInvalid: SubmitErrorHandler<RuleFormValues> = (errors): void => {
    if (!existing) {
      trackNewAlerRuleFormError({
        grafana_version: config.buildInfo.version,
        org_id: contextSrv.user.orgId,
        user_id: contextSrv.user.id,
        error: Object.keys(errors).toString(),
      });
    }
    notifyApp.error('There are errors in the form. Please correct them and try again!');
  };

  const cancelRuleCreation = () => {
    logInfo(LogMessages.cancelSavingAlertRule);
  };
  const evaluateEveryInForm = watch('evaluateEvery');
  useEffect(() => setEvaluateEvery(evaluateEveryInForm), [evaluateEveryInForm]);

  const actionButtons = (
    <HorizontalGroup height="auto" justify="flex-end">
      {existing && (
        <Button
          variant="primary"
          type="button"
          size="sm"
          onClick={handleSubmit((values) => submit(values, false), onInvalid)}
          disabled={submitState.loading}
        >
          {submitState.loading && <Spinner className={styles.buttonSpinner} inline={true} />}
          Save rule
        </Button>
      )}
      <Button
        variant="primary"
        type="button"
        size="sm"
        onClick={handleSubmit((values) => submit(values, true), onInvalid)}
        disabled={submitState.loading}
      >
        {submitState.loading && <Spinner className={styles.buttonSpinner} inline={true} />}
        Save rule and exit
      </Button>
      <Link to={returnTo}>
        <Button variant="secondary" disabled={submitState.loading} type="button" onClick={cancelRuleCreation} size="sm">
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
          disabled={submitState.loading}
          size="sm"
        >
          Edit YAML
        </Button>
      )}
    </HorizontalGroup>
  );

  return (
    <FormProvider {...formAPI}>
      <AppChromeUpdate actions={actionButtons} />
      <form onSubmit={(e) => e.preventDefault()} className={styles.form}>
        <div className={styles.contentOuter}>
          <CustomScrollbar autoHeightMin="100%" hideHorizontalTrack={true}>
            <Stack direction="column" gap={3}>
              {/* Step 1 */}
              <AlertRuleNameInput />
              {/* Step 2 */}
              <QueryAndExpressionsStep editingExistingRule={!!existing} onDataChange={checkAlertCondition} />
              {/* Step 3-4-5 */}
              {showDataSourceDependantStep && (
                <>
                  {/* Step 3 */}
                  {type === RuleFormType.grafana && (
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
                  {type !== RuleFormType.cloudRecording && <AnnotationsStep />}
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
        type === RuleFormType.grafana ? (
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
    evaluateEvery: MINUTE,
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
    flex: 1,
  }),
  flexRow: css({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
  }),
});
