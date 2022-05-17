import { css } from '@emotion/css';
import React, { FC, useMemo, useState } from 'react';
import { useForm, FormProvider, UseFormWatch } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';

import { GrafanaTheme2 } from '@grafana/data';
import { PageToolbar, Button, useStyles2, CustomScrollbar, Spinner, ConfirmModal } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { RuleWithLocation } from 'app/types/unified-alerting';

import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { deleteRuleAction, saveRuleFormAction } from '../../state/actions';
import { RuleFormType, RuleFormValues } from '../../types/rule-form';
import { initialAsyncRequestState } from '../../utils/redux';
import { rulerRuleToFormValues, getDefaultFormValues, getDefaultQueries } from '../../utils/rule-form';
import * as ruleId from '../../utils/rule-id';

import { CloudEvaluationBehavior } from './CloudEvaluationBehavior';
import { DetailsStep } from './DetailsStep';
import { GrafanaEvaluationBehavior } from './GrafanaEvaluationBehavior';
import { NotificationsStep } from './NotificationsStep';
import { RuleInspector } from './RuleInspector';
import { QueryAndAlertConditionStep } from './query-and-alert-condition/QueryAndAlertConditionStep';

type Props = {
  existing?: RuleWithLocation;
};

export const AlertRuleForm: FC<Props> = ({ existing }) => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const notifyApp = useAppNotification();
  const [queryParams] = useQueryParams();
  const [showEditYaml, setShowEditYaml] = useState(false);

  const returnTo: string = (queryParams['returnTo'] as string | undefined) ?? '/alerting/list';
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);

  const defaultValues: RuleFormValues = useMemo(() => {
    if (existing) {
      return rulerRuleToFormValues(existing);
    }
    return {
      ...getDefaultFormValues(),
      queries: getDefaultQueries(),
      ...(queryParams['defaults'] ? JSON.parse(queryParams['defaults'] as string) : {}),
      type: RuleFormType.grafana,
    };
  }, [existing, queryParams]);

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
  useCleanup((state) => state.unifiedAlerting.ruleForm.saveRule);

  const submit = (values: RuleFormValues, exitOnSave: boolean) => {
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

  const onInvalid = () => {
    notifyApp.error('There are errors in the form. Please correct them and try again!');
  };

  return (
    <FormProvider {...formAPI}>
      <form onSubmit={(e) => e.preventDefault()} className={styles.form}>
        <PageToolbar title={`${existing ? 'Edit' : 'Create'} alert rule`} pageIcon="bell">
          <Link to={returnTo}>
            <Button variant="secondary" disabled={submitState.loading} type="button" fill="outline">
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
        </PageToolbar>
        <div className={styles.contentOuter}>
          <CustomScrollbar autoHeightMin="100%" hideHorizontalTrack={true}>
            <div className={styles.contentInner}>
              <QueryAndAlertConditionStep editingExistingRule={!!existing} />
              {showStep2 && (
                <>
                  {type === RuleFormType.grafana ? <GrafanaEvaluationBehavior /> : <CloudEvaluationBehavior />}
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
      margin: ${theme.spacing(0, 2, 2)};
      overflow: hidden;
      flex: 1;
    `,
    flexRow: css`
      display: flex;
      flex-direction: row;
      justify-content: flex-start;
    `,
  };
};
