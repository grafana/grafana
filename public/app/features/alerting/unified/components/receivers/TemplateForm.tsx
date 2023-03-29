import { css } from '@emotion/css';
import { Location } from 'history';
import React, { ReactElement, useState } from 'react';
import { FormProvider, useForm, useFormContext, Validate } from 'react-hook-form';
import { useLocation } from 'react-router-dom';
import { useToggle } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Alert, Button, Field, FieldSet, Icon, Input, LinkButton, TextArea, useStyles2 } from '@grafana/ui';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';

import { TemplatePreviewResult, usePreviewPayloadMutation } from '../../api/templateApi';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { updateAlertManagerConfigAction } from '../../state/actions';
import { makeAMLink } from '../../utils/misc';
import { initialAsyncRequestState } from '../../utils/redux';
import { ensureDefine } from '../../utils/templates';
import { ProvisionedResource, ProvisioningAlert } from '../Provisioning';

import { PayloadEditor } from './PayloadEditor';
import { TemplateDataDocs } from './TemplateDataDocs';
import { TemplateEditor } from './TemplateEditor';
import { snippets } from './editor/templateDataSuggestions';

export interface TemplateFormValues {
  name: string;
  content: string;
}

export const defaults: TemplateFormValues = Object.freeze({
  name: '',
  content: '',
});

interface Props {
  existing?: TemplateFormValues;
  config: AlertManagerCortexConfig;
  alertManagerSourceName: string;
  provenance?: string;
}
export const isDuplicating = (location: Location) => location.pathname.endsWith('/duplicate');

export const TemplateForm = ({ existing, alertManagerSourceName, config, provenance }: Props) => {
  const NO_DEFAULT_TEMPLATE = 'No default template found';

  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();

  useCleanup((state) => (state.unifiedAlerting.saveAMConfig = initialAsyncRequestState));

  const { loading, error } = useUnifiedAlertingSelector((state) => state.saveAMConfig);

  const location = useLocation();
  const isduplicating = isDuplicating(location);

  const [payload, setPayload] = useState(NO_DEFAULT_TEMPLATE);
  const [payloadFormatError, setPayloadFormatError] = useState<string | null>(null);

  const [isPayloadEditorOpen, toggleIsPayloadEditorOpen] = useToggle(false);
  const [isTemplateDataDocsOpen, toggleTemplateDataDocsOpen] = useToggle(false);

  const submit = (values: TemplateFormValues) => {
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

  const formApi = useForm<TemplateFormValues>({
    mode: 'onSubmit',
    defaultValues: existing ?? defaults,
  });
  const {
    handleSubmit,
    register,
    formState: { errors },
    getValues,
    setValue,
  } = formApi;

  const validateNameIsUnique: Validate<string> = (name: string) => {
    return !config.template_files[name] || existing?.name === name
      ? true
      : 'Another template with this name already exists.';
  };

  return (
    <FormProvider {...formApi}>
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
            <TemplatePreview
              payload={payload}
              payloadFormatError={payloadFormatError}
              setPayloadFormatError={setPayloadFormatError}
            />
          </div>
        </FieldSet>

        <ExpandableSection
          title="Data Cheat sheet"
          isOpen={isTemplateDataDocsOpen}
          toggleOpen={toggleTemplateDataDocsOpen}
        >
          <TemplateDataDocs />
        </ExpandableSection>
        <ExpandableSection title="Edit Payload" isOpen={isPayloadEditorOpen} toggleOpen={toggleIsPayloadEditorOpen}>
          <PayloadEditor payload={payload} setPayload={setPayload} />
        </ExpandableSection>
      </form>
    </FormProvider>
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

interface ExpandableSectionProps {
  title: string;
  isOpen: boolean;
  toggleOpen: React.MouseEventHandler<HTMLDivElement> | undefined;
  children: ReactElement;
}

function ExpandableSection({ isOpen, toggleOpen, children, title }: ExpandableSectionProps) {
  const styles = useStyles2(getStyles);
  return (
    <Stack gap={2} direction="column">
      <div className={styles.previewHeader} onClick={toggleOpen}>
        <div className={styles.toggle}>
          <Icon name={isOpen ? 'angle-down' : 'angle-right'} />
        </div>
        <div className={styles.previewHeaderTitle}>{title}</div>
      </div>
      {isOpen && <>{children}</>}
    </Stack>
  );
}

function getResultsString(results: TemplatePreviewResult[]) {
  return results.map((result: TemplatePreviewResult) => `Template: ${result.name}\n${result.text}`).join(`\n\n`);
}
export const PREVIEW_NOT_AVAILABLE = 'Preview is not available';
export function TemplatePreview({
  payload,
  setPayloadFormatError,
  payloadFormatError,
}: {
  payload: string;
  payloadFormatError: string | null;
  setPayloadFormatError: (value: React.SetStateAction<string | null>) => void;
}) {
  const styles = useStyles2(getStyles);

  const { watch } = useFormContext<TemplateFormValues>();

  const templateContent = watch('content');
  const [trigger, { data, isError: isPreviewError }] = usePreviewPayloadMutation();
  const previewResults = data?.results;
  const previewError = isPreviewError ? data?.error ?? PREVIEW_NOT_AVAILABLE : undefined;

  const hasError: boolean = isPreviewError || Boolean(payloadFormatError);
  const errorToRender = payloadFormatError || previewError;
  const previewResultsToRender = previewResults ? getResultsString(previewResults) : '';

  const previewToRender = hasError ? errorToRender : previewResultsToRender ?? PREVIEW_NOT_AVAILABLE;

  const onPreview = () => {
    try {
      JSON.parse(payload);
      trigger({ template: templateContent, payload: payload });
      setPayloadFormatError(null);
    } catch (e) {
      setPayloadFormatError(e instanceof Error ? e.message : 'Invalid JSON.');
    }
  };

  return (
    <Stack direction="row" alignItems="center" gap={2}>
      <Button onClick={onPreview} icon="arrow-right">
        Preview
      </Button>

      <Stack direction="column">
        <div className={styles.preview.title}> Preview</div>
        <TextArea
          required={true}
          value={previewToRender}
          disabled={true}
          className={styles.preview.textArea}
          rows={10}
          cols={50}
          data-testid="payloadJSON"
        />
      </Stack>
    </Stack>
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
  toggle: css({
    color: theme.colors.text.secondary,
    marginRight: `${theme.spacing(1)}`,
  }),
  previewHeader: css({
    display: 'flex',
    cursor: 'pointer',
    alignItems: 'baseline',
    color: theme.colors.text.primary,
    '&:hover': {
      background: theme.colors.emphasize(theme.colors.background.primary, 0.03),
    },
  }),
  previewHeaderTitle: css({
    flexGrow: 1,
    overflow: 'hidden',
    fontSize: theme.typography.h4.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    margin: 0,
  }),
  preview: {
    title: css`
    fontSize: ${theme.typography.bodySmall.fontSize};,
    `,
    textArea: css`
      width: 605px;
      height: 291px;
    `,
  },
});
