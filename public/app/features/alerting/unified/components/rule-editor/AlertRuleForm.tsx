import React, { FC, useMemo } from 'react';
import { GrafanaTheme } from '@grafana/data';
import { PageToolbar, ToolbarButton, useStyles, CustomScrollbar, Spinner, Alert } from '@grafana/ui';
import { css } from '@emotion/css';

import { AlertTypeStep } from './AlertTypeStep';
import { ConditionsStep } from './ConditionsStep';
import { DetailsStep } from './DetailsStep';
import { QueryStep } from './QueryStep';
import { useForm, FormContext } from 'react-hook-form';

import { RuleFormType, RuleFormValues } from '../../types/rule-form';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { initialAsyncRequestState } from '../../utils/redux';
import { saveRuleFormAction } from '../../state/actions';
import { RuleWithLocation } from 'app/types/unified-alerting';
import { useDispatch } from 'react-redux';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { rulerRuleToFormValues, defaultFormValues } from '../../utils/rule-form';
import { Link } from 'react-router-dom';
import { config } from '@grafana/runtime';

type Props = {
  existing?: RuleWithLocation;
};

export const AlertRuleForm: FC<Props> = ({ existing }) => {
  const styles = useStyles(getStyles);
  const dispatch = useDispatch();

  const defaultValues: RuleFormValues = useMemo(() => {
    if (existing) {
      return rulerRuleToFormValues(existing);
    }
    return defaultFormValues;
  }, [existing]);

  const formAPI = useForm<RuleFormValues>({
    mode: 'onSubmit',
    defaultValues,
  });

  const { handleSubmit, watch, errors } = formAPI;

  const hasErrors = !!Object.values(errors).filter((x) => !!x).length;

  const type = watch('type');
  const dataSourceName = watch('dataSourceName');

  const showStep2 = Boolean(type && (type === RuleFormType.threshold || !!dataSourceName));

  const submitState = useUnifiedAlertingSelector((state) => state.ruleForm.saveRule) || initialAsyncRequestState;
  useCleanup((state) => state.unifiedAlerting.ruleForm.saveRule);

  const submit = (values: RuleFormValues, exitOnSave: boolean) => {
    console.log('submit', values);
    dispatch(
      saveRuleFormAction({
        values: {
          ...defaultValues,
          ...values,
          annotations: values.annotations?.filter(({ key }) => !!key) ?? [],
          labels: values.labels?.filter(({ key }) => !!key) ?? [],
        },
        existing,
        exitOnSave,
      })
    );
  };

  return (
    <FormContext {...formAPI}>
      <form onSubmit={handleSubmit((values) => submit(values, false))} className={styles.form}>
        <PageToolbar title="Create alert rule" pageIcon="bell" className={styles.toolbar}>
          <Link to={`${config.appSubUrl ?? ''}/alerting/list`}>
            <ToolbarButton variant="default" disabled={submitState.loading} type="button">
              Cancel
            </ToolbarButton>
          </Link>
          <ToolbarButton
            variant="primary"
            type="button"
            onClick={handleSubmit((values) => submit(values, false))}
            disabled={submitState.loading}
          >
            {submitState.loading && <Spinner className={styles.buttonSpinner} inline={true} />}
            Save
          </ToolbarButton>
          <ToolbarButton
            variant="primary"
            type="button"
            onClick={handleSubmit((values) => submit(values, true))}
            disabled={submitState.loading}
          >
            {submitState.loading && <Spinner className={styles.buttonSpinner} inline={true} />}
            Save and exit
          </ToolbarButton>
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
    </FormContext>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    buttonSpinner: css`
      margin-right: ${theme.spacing.sm};
    `,
    toolbar: css`
      padding-top: ${theme.spacing.sm};
      padding-bottom: ${theme.spacing.md};
      border-bottom: solid 1px ${theme.colors.border2};
    `,
    form: css`
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
    `,
    contentInner: css`
      flex: 1;
      padding: ${theme.spacing.md};
    `,
    contentOuter: css`
      background: ${theme.colors.panelBg};
      overflow: hidden;
      flex: 1;
    `,
    formInput: css`
      width: 400px;
      & + & {
        margin-left: ${theme.spacing.sm};
      }
    `,
    flexRow: css`
      display: flex;
      flex-direction: row;
      justify-content: flex-start;
    `,
  };
};
