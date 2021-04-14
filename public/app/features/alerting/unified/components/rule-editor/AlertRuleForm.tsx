import React, { FC, useMemo } from 'react';
import { GrafanaTheme } from '@grafana/data';
import { PageToolbar, ToolbarButton, useStyles, CustomScrollbar, Spinner, Alert } from '@grafana/ui';
import { css } from '@emotion/css';

import { AlertTypeStep } from './AlertTypeStep';
import { ConditionsStep } from './ConditionsStep';
import { DetailsStep } from './DetailsStep';
import { QueryStep } from './QueryStep';
import { useForm, FormContext } from 'react-hook-form';

//import { locationService } from '@grafana/runtime';
import { RuleFormValues } from '../../types/rule-form';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { initialAsyncRequestState } from '../../utils/redux';
import { saveRuleFormAction } from '../../state/actions';
import { RuleWithLocation } from 'app/types/unified-alerting';
import { useDispatch } from 'react-redux';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { rulerRuleToFormValues, defaultFormValues } from '../../utils/rule-form';

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

  const { handleSubmit, watch } = formAPI;

  const type = watch('type');
  const dataSourceName = watch('dataSourceName');

  const showStep2 = Boolean(dataSourceName && type);

  const submitState = useUnifiedAlertingSelector((state) => state.ruleForm.saveRule) || initialAsyncRequestState;
  useCleanup((state) => state.unifiedAlerting.ruleForm.saveRule);

  const submit = (values: RuleFormValues) => {
    console.log('submit', values);
    dispatch(
      saveRuleFormAction({
        values: {
          ...values,
          annotations: values.annotations?.filter(({ key }) => !!key) ?? [],
          labels: values.labels?.filter(({ key }) => !!key) ?? [],
        },
        existing,
      })
    );
  };

  return (
    <FormContext {...formAPI}>
      <form onSubmit={handleSubmit(submit)} className={styles.form}>
        <PageToolbar title="Create alert rule" pageIcon="bell" className={styles.toolbar}>
          <ToolbarButton variant="default" disabled={submitState.loading}>
            Cancel
          </ToolbarButton>
          <ToolbarButton variant="primary" type="submit" disabled={submitState.loading}>
            {submitState.loading && <Spinner className={styles.buttonSpiner} inline={true} />}
            Save
          </ToolbarButton>
          <ToolbarButton variant="primary" disabled={submitState.loading}>
            {submitState.loading && <Spinner className={styles.buttonSpiner} inline={true} />}
            Save and exit
          </ToolbarButton>
        </PageToolbar>
        <div className={styles.contentOutter}>
          <CustomScrollbar autoHeightMin="100%" hideHorizontalTrack={true}>
            <div className={styles.contentInner}>
              {submitState.error && (
                <Alert severity="error" title="Error saving rule">
                  {submitState.error.message || (submitState.error as any)?.data?.message || String(submitState.error)}
                </Alert>
              )}
              <AlertTypeStep />
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
    buttonSpiner: css`
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
    contentOutter: css`
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
