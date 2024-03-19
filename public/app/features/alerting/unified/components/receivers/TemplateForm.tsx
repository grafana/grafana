import { css } from '@emotion/css';
import { subDays } from 'date-fns';
import { Location } from 'history';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FormProvider, useForm, useFormContext, Validate } from 'react-hook-form';
import { useLocation } from 'react-router-dom';
import { useToggle } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { isFetchError } from '@grafana/runtime';
import {
  Alert,
  Button,
  Field,
  FieldSet,
  Input,
  LinkButton,
  useStyles2,
  Stack,
  LoadingPlaceholder,
  IconButton,
  Drawer,
  InlineField,
} from '@grafana/ui';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';

import { AppChromeUpdate } from '../../../../../core/components/AppChrome/AppChromeUpdate';
import {
  AlertField,
  TemplatePreviewErrors,
  TemplatePreviewResponse,
  TemplatePreviewResult,
  usePreviewTemplateMutation,
} from '../../api/templateApi';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { updateAlertManagerConfigAction } from '../../state/actions';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { makeAMLink } from '../../utils/misc';
import { initialAsyncRequestState } from '../../utils/redux';
import { ensureDefine } from '../../utils/templates';
import { ProvisionedResource, ProvisioningAlert } from '../Provisioning';
import { EditorColumnHeader } from '../contact-points/templates/EditorColumnHeader';

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

const DEFAULT_PAYLOAD = `[
  {
    "annotations": {
      "summary": "Instance instance1 has been down for more than 5 minutes"
    },
    "labels": {
      "instance": "instance1"
    },
    "startsAt": "${subDays(new Date(), 1).toISOString()}"
  }]
`;

export const TemplateForm = ({ existing, alertManagerSourceName, config, provenance }: Props) => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();

  useCleanup((state) => (state.unifiedAlerting.saveAMConfig = initialAsyncRequestState));
  const formRef = useRef<HTMLFormElement>(null);

  const { loading, error } = useUnifiedAlertingSelector((state) => state.saveAMConfig);

  const [cheatsheetOpened, toggleCheatsheetOpened] = useToggle(false);
  const [payloadOpened, togglePayloadOpened] = useToggle(true);

  const location = useLocation();
  const isduplicating = isDuplicating(location);

  const [payload, setPayload] = useState(DEFAULT_PAYLOAD);
  const [payloadFormatError, setPayloadFormatError] = useState<string | null>(null);

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
    watch,
  } = formApi;

  const validateNameIsUnique: Validate<string, TemplateFormValues> = (name: string) => {
    return !config.template_files[name] || existing?.name === name
      ? true
      : 'Another template with this name already exists.';
  };
  const isGrafanaAlertManager = alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME;

  const actionButtons = (
    <Stack>
      <Button onClick={() => formRef.current?.requestSubmit()} variant="primary" size="sm" disabled={loading}>
        Save
      </Button>
      <LinkButton
        disabled={loading}
        href={makeAMLink('alerting/notifications', alertManagerSourceName)}
        variant="secondary"
        size="sm"
      >
        Cancel
      </LinkButton>
    </Stack>
  );

  return (
    <>
      <FormProvider {...formApi}>
        <AppChromeUpdate actions={actionButtons} />
        <form onSubmit={handleSubmit(submit)} ref={formRef}>
          <h4>{existing && !isduplicating ? 'Edit notification template' : 'Create notification template'}</h4>
          {error && (
            <Alert severity="error" title="Error saving template">
              {error.message || (isFetchError(error) && error.data?.message) || String(error)}
            </Alert>
          )}
          {provenance && <ProvisioningAlert resource={ProvisionedResource.Template} />}
          <FieldSet disabled={Boolean(provenance)}>
            <InlineField
              label="Template name"
              error={errors?.name?.message}
              invalid={!!errors.name?.message}
              required
              className={styles.nameField}
            >
              <Input
                {...register('name', {
                  required: { value: true, message: 'Required.' },
                  validate: { nameIsUnique: validateNameIsUnique },
                })}
                placeholder="Give your template a name"
                width={42}
                autoFocus={true}
              />
            </InlineField>
            <div className={styles.contentContainer}>
              <Field
                label={
                  <EditorColumnHeader
                    label="Template content"
                    actions={
                      <Button
                        icon="info-circle"
                        size="sm"
                        fill="outline"
                        variant="secondary"
                        onClick={toggleCheatsheetOpened}
                      >
                        Cheatsheet
                      </Button>
                    }
                  />
                }
                error={errors?.content?.message}
                invalid={!!errors.content?.message}
                required
                className={styles.contentField}
              >
                <AutoSizer disableHeight>
                  {({ width }) => (
                    <TemplateEditor
                      value={getValues('content')}
                      onBlur={(value) => setValue('content', value)}
                      containerStyles={styles.editorContainer}
                      width={width}
                      height={598}
                    />
                  )}
                </AutoSizer>
              </Field>
              {isGrafanaAlertManager && (
                <>
                  <div className={styles.templatePreview}>
                    <TemplatePreview
                      payload={payload}
                      templateName={watch('name')}
                      setPayloadFormatError={setPayloadFormatError}
                      payloadFormatError={payloadFormatError}
                    />
                  </div>
                  <IconButton
                    name={payloadOpened ? 'angle-double-right' : 'angle-double-left'}
                    aria-label='Toggle "Payload" section'
                    onClick={togglePayloadOpened}
                    className={styles.payloadCollapseButton}
                  >
                    Payload
                  </IconButton>
                </>
              )}
              {payloadOpened && (
                <div className={styles.templatePayload}>
                  <PayloadEditor
                    payload={payload}
                    setPayload={setPayload}
                    defaultPayload={DEFAULT_PAYLOAD}
                    setPayloadFormatError={setPayloadFormatError}
                    payloadFormatError={payloadFormatError}
                  />
                </div>
              )}
            </div>
          </FieldSet>
        </form>
      </FormProvider>
      {cheatsheetOpened && (
        <Drawer title="Templating cheat sheet" onClose={toggleCheatsheetOpened} size="lg">
          <TemplatingCheatSheet />
        </Drawer>
      )}
    </>
  );
};

function TemplatingBasics() {
  const styles = useStyles2(getStyles);

  return (
    <Alert title="How to" severity="info">
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
            variant="secondary"
          >
            Templating documentation
          </LinkButton>
        </div>
      </Stack>

      <div className={styles.snippets}>
        For auto-completion of common templating code, type the following keywords in the content editor:
        <div className={styles.code}>
          {Object.values(snippets)
            .map((s) => s.label)
            .join(', ')}
        </div>
      </div>
    </Alert>
  );
}

function TemplatingCheatSheet() {
  return (
    <Stack direction="column" gap={1}>
      <TemplatingBasics />
      <TemplateDataDocs />
    </Stack>
  );
}

function getResultsToRender(results: TemplatePreviewResult[]) {
  const filteredResults = results.filter((result) => result.text.trim().length > 0);

  const moreThanOne = filteredResults.length > 1;

  const preview = (result: TemplatePreviewResult) => {
    const previewForLabel = `Preview for ${result.name}:`;
    const separatorStart = '='.repeat(previewForLabel.length).concat('>');
    const separatorEnd = '<'.concat('='.repeat(previewForLabel.length));
    if (moreThanOne) {
      return `${previewForLabel}\n${separatorStart}${result.text}${separatorEnd}\n`;
    } else {
      return `${separatorStart}${result.text}${separatorEnd}\n`;
    }
  };

  return filteredResults
    .map((result: TemplatePreviewResult) => {
      return preview(result);
    })
    .join(`\n`);
}

function getErrorsToRender(results: TemplatePreviewErrors[]) {
  return results
    .map((result: TemplatePreviewErrors) => {
      if (result.name) {
        return `ERROR in ${result.name}:\n`.concat(`${result.kind}\n${result.message}\n`);
      } else {
        return `ERROR:\n${result.kind}\n${result.message}\n`;
      }
    })
    .join(`\n`);
}

export const PREVIEW_NOT_AVAILABLE = 'Preview request failed. Check if the payload data has the correct structure.';

function getPreviewTorender(
  isPreviewError: boolean,
  payloadFormatError: string | null,
  data: TemplatePreviewResponse | undefined
) {
  // ERRORS IN JSON OR IN REQUEST (endpoint not available, for example)
  const previewErrorRequest = isPreviewError ? PREVIEW_NOT_AVAILABLE : undefined;
  const somethingWasWrong: boolean = isPreviewError || Boolean(payloadFormatError);
  const errorToRender = payloadFormatError || previewErrorRequest;

  //PREVIEW : RESULTS AND ERRORS
  const previewResponseResults = data?.results;
  const previewResponseErrors = data?.errors;

  const previewResultsToRender = previewResponseResults ? getResultsToRender(previewResponseResults) : '';
  const previewErrorsToRender = previewResponseErrors ? getErrorsToRender(previewResponseErrors) : '';

  if (somethingWasWrong) {
    return errorToRender;
  } else {
    return `${previewResultsToRender}\n${previewErrorsToRender}`;
  }
}

export function TemplatePreview({
  payload,
  templateName,
  payloadFormatError,
  setPayloadFormatError,
}: {
  payload: string;
  templateName: string;
  payloadFormatError: string | null;
  setPayloadFormatError: (value: React.SetStateAction<string | null>) => void;
}) {
  const styles = useStyles2(getStyles);

  const { watch } = useFormContext<TemplateFormValues>();

  const templateContent = watch('content');

  const [trigger, { data, isError: isPreviewError, isLoading }] = usePreviewTemplateMutation();

  const previewToRender = getPreviewTorender(isPreviewError, payloadFormatError, data);

  const onPreview = useCallback(() => {
    try {
      const alertList: AlertField[] = JSON.parse(payload);
      JSON.stringify([...alertList]); // check if it's iterable, in order to be able to add more data
      trigger({ template: templateContent, alerts: alertList, name: templateName });
      setPayloadFormatError(null);
    } catch (e) {
      setPayloadFormatError(e instanceof Error ? e.message : 'Invalid JSON.');
    }
  }, [templateContent, templateName, payload, setPayloadFormatError, trigger]);

  useEffect(() => onPreview(), [onPreview]);

  return (
    <div className={styles.preview.container}>
      <EditorColumnHeader
        label="Template preview"
        actions={
          <Button
            icon="sync"
            aria-label="Refresh preview"
            onClick={onPreview}
            size="sm"
            variant="secondary"
            fill="outline"
          >
            Refresh
          </Button>
        }
      />
      {isLoading && <LoadingPlaceholder text="Loading preview..." />}
      <pre className={styles.preview.result} data-testid="payloadJSON">
        {previewToRender}
      </pre>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  label: css({
    margin: 0,
  }),
  nameField: css({
    marginBottom: theme.spacing(3),
  }),
  contentContainer: css({
    display: 'flex',
    flexDirection: 'row',
    gap: theme.spacing(1),
    height: theme.spacing(82),
    maxHeight: theme.spacing(82),
    '& > *': {
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.strong}`,
    },
  }),
  contentField: css({
    flex: 3,
    marginBottom: 0,
  }),
  templatePreview: css({
    flex: 2,
  }),
  templatePayload: css({
    flex: 2,
  }),
  editorContainer: css({
    width: 'fit-content',
    border: 'none',
  }),
  payloadCollapseButton: css({
    backgroundColor: theme.colors.info.transparent,
    margin: 0,
  }),
  snippets: css`
    margin-top: ${theme.spacing(2)};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
  code: css`
    color: ${theme.colors.text.secondary};
    font-weight: ${theme.typography.fontWeightBold};
  `,
  preview: {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      maxHeight: '100%',
    }),
    result: css({
      backgroundColor: theme.colors.background.primary,
      margin: 0,
      border: 'none',
    }),
  },
});
