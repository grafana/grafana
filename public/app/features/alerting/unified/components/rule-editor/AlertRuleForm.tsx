import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';
import { DeepMap, FieldError, FormProvider, useForm, useFormContext, UseFormWatch } from 'react-hook-form';
import { Link } from 'react-router-dom';

import { GrafanaTheme2 } from '@grafana/data';
import { logInfo, config } from '@grafana/runtime';
import { Button, ConfirmModal, CustomScrollbar, Spinner, useStyles2, HorizontalGroup, Field, Input } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/core';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { useDispatch } from 'app/types';
import { RuleWithLocation } from 'app/types/unified-alerting';

import { LogMessages, trackNewAlerRuleFormCancelled, trackNewAlerRuleFormError } from '../../Analytics';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { deleteRuleAction, saveRuleFormAction } from '../../state/actions';
import { RuleFormType, RuleFormValues } from '../../types/rule-form';
import { initialAsyncRequestState } from '../../utils/redux';
import { getDefaultFormValues, getDefaultQueries, rulerRuleToFormValues } from '../../utils/rule-form';
import * as ruleId from '../../utils/rule-id';

import { CloudEvaluationBehavior } from './CloudEvaluationBehavior';
import { DetailsStep } from './DetailsStep';
import { GrafanaEvaluationBehavior } from './GrafanaEvaluationBehavior';
import { NotificationsStep } from './NotificationsStep';
import { RuleEditorSection } from './RuleEditorSection';
import { RuleInspector } from './RuleInspector';
import { QueryAndExpressionsStep } from './query-and-alert-condition/QueryAndExpressionsStep';

const recordingRuleNameValidationPattern = {
  message:
    'Recording rule name must be valid metric name. It may only contain letters, numbers, and colons. It may not contain whitespace.',
  value: /^[a-zA-Z_:][a-zA-Z0-9_:]*$/,
};

const AlertRuleNameInput = () => {
  const styles = useStyles2(getStyles);
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<RuleFormValues & { location?: string }>();

  const ruleFormType = watch('type');
  return (
    <RuleEditorSection stepNo={1} title="Set an alert rule name">
      <Field
        className={styles.formInput}
        label="Rule name"
        description="Name for the alert rule."
        error={errors?.name?.message}
        invalid={!!errors.name?.message}
      >
        <Input
          id="name"
          {...register('name', {
            required: { value: true, message: 'Must enter an alert name' },
            pattern: ruleFormType === RuleFormType.cloudRecording ? recordingRuleNameValidationPattern : undefined,
          })}
          placeholder="Give your alert rule a name."
        />
      </Field>
    </RuleEditorSection>
  );
};

export const MINUTE = '1m';

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

  const returnTo: string = (queryParams['returnTo'] as string | undefined) ?? '/alerting/list';
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);

  const defaultValues: RuleFormValues = useMemo(() => {
    if (existing) {
      return rulerRuleToFormValues(existing);
    }

    if (prefill) {
      return {
        ...getDefaultFormValues(),
        ...prefill,
      };
    }

    return {
      ...getDefaultFormValues(),
      queries: getDefaultQueries(),
      condition: 'C',
      ...(queryParams['defaults'] ? JSON.parse(queryParams['defaults'] as string) : {}),
      type: RuleFormType.grafana,
      evaluateEvery: evaluateEvery,
    };
  }, [existing, prefill, queryParams, evaluateEvery]);

  const formAPI = useForm<RuleFormValues>({
    mode: 'onSubmit',
    defaultValues,
    shouldFocusError: true,
  });

  const { handleSubmit, watch } = formAPI;

  const type = watch('type');
  const dataSourceName = watch('dataSourceName');

  const showStep2 = Boolean(type && (type === RuleFormType.grafana || !!dataSourceName));

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

  const onInvalid = (errors: DeepMap<RuleFormValues, FieldError>): void => {
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
    if (!existing) {
      trackNewAlerRuleFormCancelled({
        grafana_version: config.buildInfo.version,
        org_id: contextSrv.user.orgId,
        user_id: contextSrv.user.id,
      });
    }
  };
  const evaluateEveryInForm = watch('evaluateEvery');
  useEffect(() => setEvaluateEvery(evaluateEveryInForm), [evaluateEveryInForm]);

  return (
    <FormProvider {...formAPI}>
      <form onSubmit={(e) => e.preventDefault()} className={styles.form}>
        <HorizontalGroup height="auto" justify="flex-end">
          <Link to={returnTo}>
            <Button
              variant="secondary"
              disabled={submitState.loading}
              type="button"
              fill="outline"
              onClick={cancelRuleCreation}
            >
              Cancel
            </Button>
          </Link>
          {existing ? (
            <Button variant="destructive" type="button" onClick={() => setShowDeleteModal(true)}>
              Delete
            </Button>
          ) : null}
          {isCortexLokiOrRecordingRule(watch) && (
            <Button
              variant="secondary"
              type="button"
              onClick={() => setShowEditYaml(true)}
              disabled={submitState.loading}
            >
              Edit yaml
            </Button>
          )}
          <Button
            variant="primary"
            type="button"
            onClick={handleSubmit((values) => submit(values, false), onInvalid)}
            disabled={submitState.loading}
          >
            {submitState.loading && <Spinner className={styles.buttonSpinner} inline={true} />}
            Save
          </Button>
          <Button
            variant="primary"
            type="button"
            onClick={handleSubmit((values) => submit(values, true), onInvalid)}
            disabled={submitState.loading}
          >
            {submitState.loading && <Spinner className={styles.buttonSpinner} inline={true} />}
            Save and exit
          </Button>
        </HorizontalGroup>
        <div className={styles.contentOuter}>
          <CustomScrollbar autoHeightMin="100%" hideHorizontalTrack={true}>
            <div className={styles.contentInner}>
              <AlertRuleNameInput />
              <QueryAndExpressionsStep editingExistingRule={!!existing} onDataChange={checkAlertCondition} />
              {showStep2 && (
                <>
                  {type === RuleFormType.grafana ? (
                    <GrafanaEvaluationBehavior
                      initialFolder={defaultValues.folder}
                      evaluateEvery={evaluateEvery}
                      setEvaluateEvery={setEvaluateEvery}
                      existing={Boolean(existing)}
                    />
                  ) : (
                    <CloudEvaluationBehavior />
                  )}
                  <DetailsStep />
                  <NotificationsStep />
                </>
              )}
            </div>
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
      {showEditYaml ? <RuleInspector onClose={() => setShowEditYaml(false)} /> : null}
    </FormProvider>
  );
};

const isCortexLokiOrRecordingRule = (watch: UseFormWatch<RuleFormValues>) => {
  const [ruleType, dataSourceName] = watch(['type', 'dataSourceName']);

  return (ruleType === RuleFormType.cloudAlerting || ruleType === RuleFormType.cloudRecording) && dataSourceName !== '';
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    buttonSpinner: css`
      margin-right: ${theme.spacing(1)};
    `,
    form: css`
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
    `,
    contentInner: css`
      flex: 1;
      padding: ${theme.spacing(2)};
    `,
    contentOuter: css`
      background: ${theme.colors.background.primary};
      border: 1px solid ${theme.colors.border.weak};
      border-radius: ${theme.shape.borderRadius()};
      overflow: hidden;
      flex: 1;
      margin-top: ${theme.spacing(1)};
    `,
    flexRow: css`
      display: flex;
      flex-direction: row;
      justify-content: flex-start;
    `,
    formInput: css`
      width: 275px;

      & + & {
        margin-left: ${theme.spacing(3)};
      }
    `,
  };
};
