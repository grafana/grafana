import { css } from '@emotion/css';
import { Location } from 'history';
import React from 'react';
import { useForm, Validate } from 'react-hook-form';
import { useLocation } from 'react-router-dom';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Alert, Button, Field, FieldSet, Input, LinkButton, useStyles2 } from '@grafana/ui';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';

import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { updateAlertManagerConfigAction } from '../../state/actions';
import { makeAMLink } from '../../utils/misc';
import { initialAsyncRequestState } from '../../utils/redux';
import { ensureDefine } from '../../utils/templates';
import { ProvisionedResource, ProvisioningAlert } from '../Provisioning';

import { TemplateDataDocs } from './TemplateDataDocs';
import { TemplateEditor } from './TemplateEditor';
import { snippets } from './editor/templateDataSuggestions';

interface Values {
  name: string;
  content: string;
}

const defaults: Values = Object.freeze({
  name: '',
  content: '',
});

interface Props {
  existing?: Values;
  config: AlertManagerCortexConfig;
  alertManagerSourceName: string;
  provenance?: string;
}
export const isDuplicating = (location: Location) => location.pathname.endsWith('/duplicate');

export const TemplateForm = ({ existing, alertManagerSourceName, config, provenance }: Props) => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();

  useCleanup((state) => (state.unifiedAlerting.saveAMConfig = initialAsyncRequestState));

  const { loading, error } = useUnifiedAlertingSelector((state) => state.saveAMConfig);

  const location = useLocation();
  const isduplicating = isDuplicating(location);

  const submit = (values: Values) => {
    // wrap content in "define" if it's not already wrapped, in case user did not do it/
    // it's not obvious that this is needed for template to work
    const content = ensureDefine(values.name, values.content);

    // add new template to template map
    const template_files = {
      ...config.template_files,
      [values.name]: content,
    };

    // delete existing one (if name changed, otherwise it was overwritten in previous step)
    if (existing && existing.name !== values.name) {
      delete template_files[existing.name];
    }

    // make sure name for the template is configured on the alertmanager config object
    const templates = [
      ...(config.alertmanager_config.templates ?? []).filter((name) => name !== existing?.name),
      values.name,
    ];

    const newConfig: AlertManagerCortexConfig = {
      template_files,
      alertmanager_config: {
        ...config.alertmanager_config,
        templates,
      },
    };
    dispatch(
      updateAlertManagerConfigAction({
        alertManagerSourceName,
        newConfig,
        oldConfig: config,
        successMessage: 'Template saved.',
        redirectPath: '/alerting/notifications',
      })
    );
  };

  const {
    handleSubmit,
    register,
    formState: { errors },
    getValues,
    setValue,
  } = useForm<Values>({
    mode: 'onSubmit',
    defaultValues: existing ?? defaults,
  });

  const validateNameIsUnique: Validate<string> = (name: string) => {
    return !config.template_files[name] || existing?.name === name
      ? true
      : 'Another template with this name already exists.';
  };
  return (
    <form onSubmit={handleSubmit(submit)}>
      <h4>{existing && !isduplicating ? 'Edit notification template' : 'Create notification template'}</h4>
      {error && (
        <Alert severity="error" title="Error saving template">
          {error.message || (error as any)?.data?.message || String(error)}
        </Alert>
      )}
      {provenance && <ProvisioningAlert resource={ProvisionedResource.Template} />}
      <FieldSet disabled={Boolean(provenance)}>
        <Field label="Template name" error={errors?.name?.message} invalid={!!errors.name?.message} required>
          <Input
            {...register('name', {
              required: { value: true, message: 'Required.' },
              validate: { nameIsUnique: validateNameIsUnique },
            })}
            placeholder="Give your template a name"
            width={42}
            autoFocus={true}
          />
        </Field>
        <TemplatingGuideline />
        <div className={styles.contentContainer}>
          <div>
            <Field label="Content" error={errors?.content?.message} invalid={!!errors.content?.message} required>
              <div className={styles.editWrapper}>
                <AutoSizer>
                  {({ width, height }) => (
                    <TemplateEditor
                      value={getValues('content')}
                      width={width}
                      height={height}
                      onBlur={(value) => setValue('content', value)}
                    />
                  )}
                </AutoSizer>
              </div>
            </Field>
            <div className={styles.buttons}>
              {loading && (
                <Button disabled={true} icon="fa fa-spinner" variant="primary">
                  Saving...
                </Button>
              )}
              {!loading && (
                <Button type="submit" variant="primary">
                  Save template
                </Button>
              )}
              <LinkButton
                disabled={loading}
                href={makeAMLink('alerting/notifications', alertManagerSourceName)}
                variant="secondary"
                type="button"
                fill="outline"
              >
                Cancel
              </LinkButton>
            </div>
          </div>
          <TemplateDataDocs />
        </div>
      </FieldSet>
    </form>
  );
};

function TemplatingGuideline() {
  const styles = useStyles2(getStyles);

  return (
    <Alert title="Templating guideline" severity="info">
      <Stack direction="row">
        <div>
          Grafana uses Go templating language to create notification messages.
          <br />
          To find out more about templating please visit our documentation.
        </div>
        <div>
          <LinkButton
            href="https://grafana.com/docs/grafana/latest/alerting/manage-notifications/template-notifications/"
            target="_blank"
            icon="external-link-alt"
          >
            Templating documentation
          </LinkButton>
        </div>
      </Stack>

      <div className={styles.snippets}>
        To make templating easier, we provide a few snippets in the content editor to help you speed up your workflow.
        <div className={styles.code}>
          {Object.values(snippets)
            .map((s) => s.label)
            .join(', ')}
        </div>
      </div>
    </Alert>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  contentContainer: css`
    display: flex;
    gap: ${theme.spacing(2)};
    flex-direction: row;
    align-items: flex-start;
    flex-wrap: wrap;
    ${theme.breakpoints.up('xxl')} {
      flex-wrap: nowrap;
    }
  `,
  snippets: css`
    margin-top: ${theme.spacing(2)};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
  code: css`
    color: ${theme.colors.text.secondary};
    font-weight: ${theme.typography.fontWeightBold};
  `,
  buttons: css`
    & > * + * {
      margin-left: ${theme.spacing(1)};
    }
  `,
  textarea: css`
    max-width: 758px;
  `,
  editWrapper: css`
    display: block;
    position: relative;
    width: 640px;
    height: 320px;
  `,
});
