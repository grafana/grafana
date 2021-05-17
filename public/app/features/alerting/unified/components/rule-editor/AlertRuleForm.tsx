import React, { FC, useMemo } from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { PageToolbar, Button, useStyles2, CustomScrollbar, Spinner, Alert } from '@grafana/ui';
import { css } from '@emotion/css';

import { AlertTypeStep } from './AlertTypeStep';
import { ConditionsStep } from './ConditionsStep';
import { DetailsStep } from './DetailsStep';
import { QueryStep } from './QueryStep';
import { useForm, FormProvider } from 'react-hook-form';

import { RuleFormType, RuleFormValues } from '../../types/rule-form';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { initialAsyncRequestState } from '../../utils/redux';
import { saveRuleFormAction } from '../../state/actions';
import { RuleWithLocation } from 'app/types/unified-alerting';
import { useDispatch } from 'react-redux';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { rulerRuleToFormValues, getDefaultFormValues, getDefaultQueries } from '../../utils/rule-form';
import { Link } from 'react-router-dom';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

type Props = {
  existing?: RuleWithLocation;
};

export const AlertRuleForm: FC<Props> = ({ existing }) => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const [queryParams] = useQueryParams();

  const returnTo: string = (queryParams['returnTo'] as string | undefined) ?? '/alerting/list';

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
  });

  const {
    handleSubmit,
    watch,
    formState: { errors },
  } = formAPI;

  const hasErrors = !!Object.values(errors).filter((x) => !!x).length;

  const type = watch('type');
  const dataSourceName = watch('dataSourceName');

  const showStep2 = Boolean(type && (type === RuleFormType.threshold || !!dataSourceName));

  const submitState = useUnifiedAlertingSelector((state) => state.ruleForm.saveRule) || initialAsyncRequestState;
  useCleanup((state) => state.unifiedAlerting.ruleForm.saveRule);

  const submit = (values: RuleFormValues, exitOnSave: boolean) => {
    dispatch(
      saveRuleFormAction({
        values: {
          ...defaultValues,
          ...values,
          annotations: values.annotations?.filter(({ key }) => !!key) ?? [],
          labels: values.labels?.filter(({ key }) => !!key) ?? [],
        },
        existing,
        redirectOnSave: exitOnSave ? returnTo : undefined,
      })
    );
  };

  return (
    <FormProvider {...formAPI}>
      <form onSubmit={handleSubmit((values) => submit(values, false))} className={styles.form}>
        <PageToolbar title="Create alert rule" pageIcon="bell">
          <Link to={returnTo}>
            <Button variant="secondary" disabled={submitState.loading} type="button" fill="outline">
              Cancel
            </Button>
          </Link>
          <Button
            variant="secondary"
            type="button"
            onClick={handleSubmit((values) => submit(values, false))}
            disabled={submitState.loading}
          >
            {submitState.loading && <Spinner className={styles.buttonSpinner} inline={true} />}
            Save
          </Button>
          <Button
            variant="primary"
            type="button"
            onClick={handleSubmit((values) => submit(values, true))}
            disabled={submitState.loading}
          >
            {submitState.loading && <Spinner className={styles.buttonSpinner} inline={true} />}
            Save and exit
          </Button>
        </PageToolbar>
        <div className={styles.contentOuter}>
          <CustomScrollbar autoHeightMin="100%" hideHorizontalTrack={true}>
            <div className={styles.contentInner}>
              {hasErrors && (
                <Alert
                  severity="error"
                  title="There are errors in the form below. Please fix them and try saving again"
                />
              )}
              {submitState.error && (
                <Alert severity="error" title="Error saving rule">
                  {submitState.error.message || (submitState.error as any)?.data?.message || String(submitState.error)}
                </Alert>
              )}
              <AlertTypeStep editingExistingRule={!!existing} />
              {showStep2 && (
                <>
                  <QueryStep />
                  <ConditionsStep />
                  <DetailsStep />
                </>
              )}
            </div>
          </CustomScrollbar>
        </div>
      </form>
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
      margin: ${theme.spacing(2)};
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
