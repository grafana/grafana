import React, { FC, useMemo, useState } from 'react';
import { GrafanaTheme2, AppEvents } from '@grafana/data';
import { PageToolbar, Button, useStyles2, CustomScrollbar, Spinner, ConfirmModal } from '@grafana/ui';
import { css } from '@emotion/css';

import { AlertTypeStep } from './AlertTypeStep';
import { DetailsStep } from './DetailsStep';
import { QueryStep } from './QueryStep';
import { useForm, FormProvider } from 'react-hook-form';

import { RuleFormType, RuleFormValues } from '../../types/rule-form';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { initialAsyncRequestState } from '../../utils/redux';
import { deleteRuleAction, saveRuleFormAction } from '../../state/actions';
import { RuleWithLocation } from 'app/types/unified-alerting';
import { useDispatch } from 'react-redux';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { rulerRuleToFormValues, getDefaultFormValues, getDefaultQueries } from '../../utils/rule-form';
import { Link } from 'react-router-dom';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { appEvents } from 'app/core/core';
import { CloudConditionsStep } from './CloudConditionsStep';
import { GrafanaConditionsStep } from './GrafanaConditionsStep';
import * as ruleId from '../../utils/rule-id';

type Props = {
  existing?: RuleWithLocation;
};

export const AlertRuleForm: FC<Props> = ({ existing }) => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const [queryParams] = useQueryParams();

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
    appEvents.emit(AppEvents.alertError, ['There are errors in the form. Please correct them and try again!']);
  };

  return (
    <FormProvider {...formAPI}>
      <form onSubmit={(e) => e.preventDefault()} className={styles.form}>
        <PageToolbar title="Create alert rule" pageIcon="bell">
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
              <AlertTypeStep editingExistingRule={!!existing} />
              {showStep2 && (
                <>
                  <QueryStep />
                  {type === RuleFormType.grafana ? <GrafanaConditionsStep /> : <CloudConditionsStep />}
                  <DetailsStep />
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
    </FormProvider>
  );
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
