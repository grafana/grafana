import { css } from '@emotion/css';
import { Location } from 'history';
import React, { ReactElement, useCallback, useEffect, useState } from 'react';
import { FormProvider, useForm, useFormContext, Validate } from 'react-hook-form';
import { useLocation } from 'react-router-dom';
import { useToggle } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import {
  Alert,
  Button,
  Field,
  FieldSet,
  Icon,
  Input,
  LinkButton,
  Spinner,
  Tab,
  TabsBar,
  useStyles2,
} from '@grafana/ui';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';

import {
  AlertField,
  TemplatePreviewErrors,
  TemplatePreviewResult,
  TemplatesPreviewResponse,
  usePreviewPayloadMutation,
} from '../../api/templateApi';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { updateAlertManagerConfigAction } from '../../state/actions';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
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

export const DEFAULT_PAYLOAD = `[
  {
    "annotations": {
      "summary": "Instance instance1 has been down for more than 5 minutes"
    },
    "labels": {
      "instance": "instance1"
    },
    "startsAt": "2023-04-01T00:00:00Z",
    "endsAt": "2023-12-01T00:05:00Z"
  }]
`;

export const TemplateForm = ({ existing, alertManagerSourceName, config, provenance }: Props) => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();

  useCleanup((state) => (state.unifiedAlerting.saveAMConfig = initialAsyncRequestState));

  const { loading, error } = useUnifiedAlertingSelector((state) => state.saveAMConfig);

  const location = useLocation();
  const isduplicating = isDuplicating(location);

  const [payload, setPayload] = useState(DEFAULT_PAYLOAD);
  const [payloadFormatError, setPayloadFormatError] = useState<string | null>(null);

  const [isPayloadEditorOpen, toggleIsPayloadEditorOpen] = useToggle(false);
  const [isTemplateDataDocsOpen, toggleTemplateDataDocsOpen] = useToggle(false);

  const [view, setView] = useState<'content' | 'preview'>('content');

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

          <TabsBar>
            <Tab label="Content" active={view === 'content'} onChangeTab={() => setView('content')} />
            {alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME && (
              <Tab label="Preview" active={view === 'preview'} onChangeTab={() => setView('preview')} />
            )}
          </TabsBar>
          <div className={styles.contentContainer}>
            {view === 'content' ? (
              <div>
                <Field error={errors?.content?.message} invalid={!!errors.content?.message} required>
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
            ) : (
              <TemplatePreview
                payload={payload}
                payloadFormatError={payloadFormatError}
                setPayloadFormatError={setPayloadFormatError}
                templateName={watch('name')}
              />
            )}
          </div>
        </FieldSet>
        <>
          <ExpandableSection
            title="Data Cheat sheet"
            isOpen={isTemplateDataDocsOpen}
            toggleOpen={toggleTemplateDataDocsOpen}
          >
            <TemplateDataDocs />
          </ExpandableSection>
          <ExpandableSection title="Edit Payload" isOpen={isPayloadEditorOpen} toggleOpen={toggleIsPayloadEditorOpen}>
            <PayloadEditor payload={payload} setPayload={setPayload} defaultPayload={DEFAULT_PAYLOAD} />
          </ExpandableSection>
        </>
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

function getResultsToRender(results: TemplatePreviewResult[]) {
  return results
    .map((result: TemplatePreviewResult) => {
      if (result.text.trim().length > 0) {
        return `Preview for ${result.name}:\n${result.text}`;
      }
      return '';
    })
    .join(`\n`);
}

function getErrorsToRender(results: TemplatePreviewErrors[]) {
  return results
    .map((result: TemplatePreviewErrors) => {
      if (result.name) {
        return `ERROR in ${result.name}:\n`.concat(`${result.kind}\n${result.message}`);
      } else {
        return `ERROR:\n${result.kind}\n${result.message}`;
      }
    })
    .join(`\n`);
}
export const PREVIEW_NOT_AVAILABLE = 'Preview is not available';

function getPreviewTorender(
  isPreviewError: boolean,
  payloadFormatError: string | null,
  data: TemplatesPreviewResponse | undefined
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
  setPayloadFormatError,
  payloadFormatError,
  templateName,
}: {
  payload: string;
  payloadFormatError: string | null;
  templateName: string;
  setPayloadFormatError: (value: React.SetStateAction<string | null>) => void;
}) {
  const styles = useStyles2(getStyles);

  const { watch } = useFormContext<TemplateFormValues>();

  const templateContent = watch('content');
  const [trigger, { data, isError: isPreviewError, isLoading }] = usePreviewPayloadMutation();

  const previewToRender = getPreviewTorender(isPreviewError, payloadFormatError, data);

  const onPreview = useCallback(() => {
    try {
      const alertList: AlertField[] = JSON.parse(payload);
      trigger({ template: templateContent, alerts: alertList, name: templateName });
      setPayloadFormatError(null);
    } catch (e) {
      setPayloadFormatError(e instanceof Error ? e.message : 'Invalid JSON.');
    }
  }, [templateContent, templateName, payload, setPayloadFormatError, trigger]);

  useEffect(() => onPreview(), [onPreview]);

  return (
    <Stack direction="row" alignItems="center" gap={2}>
      <Stack direction="column">
        {isLoading && (
          <>
            <Spinner inline={true} /> Loading preview...
          </>
        )}
        <pre className={styles.preview.result} data-testid="payloadJSON">
          {previewToRender}
        </pre>
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
    result: css`
      width: 570px;
      height: 363px;
    `,
  },
});
