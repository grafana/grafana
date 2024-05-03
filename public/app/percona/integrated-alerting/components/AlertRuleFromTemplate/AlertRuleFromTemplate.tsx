import { AxiosError } from 'axios';
import React, { FC, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';

import { locationService } from '@grafana/runtime';
import { Button, Stack, Spinner, useStyles2 } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { Page } from 'app/core/components/Page/Page';
import { useAppNotification } from 'app/core/copy/appNotification';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { PMM_ALERTING_CREATE_ALERT_TEMPLATE } from 'app/percona/shared/components/PerconaBootstrapper/PerconaNavigation';
import { ApiErrorResponse } from 'app/percona/shared/core';
import { logger } from 'app/percona/shared/helpers/logger';
import { AlertRulesService } from 'app/percona/shared/services/AlertRules/AlertRules.service';

import { TemplatedAlertFormValues } from '../../types';
import { TemplateForm } from '../TemplateForm/TemplateForm';
import { formatCreateAPIPayload } from '../TemplateForm/TemplateForm.utils';

import { getStyles } from './AlertRuleFromTemplate.styles';

export const AlertRuleFromTemplate: FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const notifyApp = useAppNotification();
  const [queryParams] = useQueryParams();
  const returnTo = !queryParams['returnTo'] ? '/alerting/list' : String(queryParams['returnTo']);
  const defaultValues: TemplatedAlertFormValues = useMemo(
    () => ({
      duration: '1m',
      evaluateEvery: '1m',
      filters: [],
      ruleName: '',
      severity: null,
      template: null,
      folder: null,
      group: '',
    }),
    []
  );
  const methods = useForm({
    mode: 'onSubmit',
    defaultValues,
    shouldFocusError: true,
  });
  const styles = useStyles2(getStyles);

  const submit = async (values: TemplatedAlertFormValues) => {
    setIsSubmitting(true);

    try {
      await AlertRulesService.create(formatCreateAPIPayload(values), undefined, true);
      notifyApp.success(`Rule "${values.ruleName}" saved.`);

      locationService.push(returnTo);
    } catch (error) {
      logger.error(error);
      const message = (error as AxiosError<ApiErrorResponse>)?.response?.data?.message;
      notifyApp.error(message || 'Failed to save rule');
    }

    setIsSubmitting(false);
  };

  const onInvalid = () => {
    notifyApp.error('There are errors in the form. Please correct them and try again!');
  };

  const actionButtons = (
    <Stack>
      <Button
        variant="primary"
        type="button"
        size="sm"
        onClick={methods.handleSubmit((values) => submit(values), onInvalid)}
        disabled={isSubmitting}
      >
        {isSubmitting && <Spinner className={styles.buttonSpinner} inline={true} />}
        Save rule and exit
      </Button>
      <Link to={returnTo}>
        <Button variant="secondary" disabled={isSubmitting} type="button" size="sm">
          Cancel
        </Button>
      </Link>
    </Stack>
  );

  return (
    <FormProvider {...methods}>
      <AppChromeUpdate actions={actionButtons} />
      <Page navId="alert-list" pageNav={PMM_ALERTING_CREATE_ALERT_TEMPLATE}>
        <TemplateForm />
      </Page>
    </FormProvider>
  );
};

export default AlertRuleFromTemplate;
