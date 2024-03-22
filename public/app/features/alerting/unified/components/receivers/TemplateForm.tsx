import { css } from '@emotion/css';
import { addMinutes, subDays, subHours } from 'date-fns';
import { Location } from 'history';
import React, { useRef, useState } from 'react';
import { FormProvider, useForm, Validate } from 'react-hook-form';
import { useLocation } from 'react-router-dom';
import { useToggle } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { isFetchError } from '@grafana/runtime';
import {
  Alert,
  Button,
  FieldSet,
  Input,
  LinkButton,
  useStyles2,
  Stack,
  IconButton,
  Drawer,
  InlineField,
  FieldValidationMessage,
  Box,
} from '@grafana/ui';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { AlertManagerCortexConfig, TestTemplateAlert } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';

import { AppChromeUpdate } from '../../../../../core/components/AppChrome/AppChromeUpdate';
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
import { TemplatePreview } from './TemplatePreview';
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

const defaultPayload: TestTemplateAlert[] = [
  {
    status: 'firing',
    annotations: {
      summary: 'Instance instance1 has been down for more than 5 minutes',
    },
    labels: {
      alertname: 'InstanceDown',
      instance: 'instance1',
    },
    startsAt: subDays(new Date(), 1).toISOString(),
    endsAt: addMinutes(new Date(), 5).toISOString(),
    fingerprint: 'a5331f0d5a9d81d4',
    generatorURL: 'http://grafana.com/alerting/grafana/cdeqmlhvflz40f/view',
  },
  {
    status: 'resolved',
    annotations: {
      summary: 'CPU usage above 90%',
    },
    labels: {
      alertname: 'CpuUsage',
      instance: 'instance1',
    },
    startsAt: subHours(new Date(), 4).toISOString(),
    endsAt: new Date().toISOString(),
    fingerprint: 'b77d941310f9d381',
    generatorURL: 'http://grafana.com/alerting/grafana/oZSMdGj7z/view',
  },
];

const defaultPayloadString = JSON.stringify(defaultPayload, null, 2);

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

  const [payload, setPayload] = useState(defaultPayloadString);
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
        <form onSubmit={handleSubmit(submit)} ref={formRef} className={styles.form}>
          <h4>{existing && !isduplicating ? 'Edit notification template' : 'Create notification template'}</h4>
          {error && (
            <Alert severity="error" title="Error saving template">
              {error.message || (isFetchError(error) && error.data?.message) || String(error)}
            </Alert>
          )}
          {provenance && <ProvisioningAlert resource={ProvisionedResource.Template} />}
          <FieldSet disabled={Boolean(provenance)} className={styles.fieldset}>
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
              <div className={styles.contentField}>
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
                <Box flex={1}>
                  <AutoSizer>
                    {({ width, height }) => (
                      <TemplateEditor
                        value={getValues('content')}
                        onBlur={(value) => setValue('content', value)}
                        containerStyles={styles.editorContainer}
                        width={width - 2}
                        height={height}
                      />
                    )}
                  </AutoSizer>
                </Box>
                {errors.content?.message && <FieldValidationMessage>{errors?.content?.message}</FieldValidationMessage>}
              </div>
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
                  />
                  {payloadOpened && (
                    <div className={styles.templatePayload}>
                      <PayloadEditor
                        payload={payload}
                        defaultPayload={defaultPayloadString}
                        setPayload={setPayload}
                        setPayloadFormatError={setPayloadFormatError}
                        payloadFormatError={payloadFormatError}
                      />
                    </div>
                  )}
                </>
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

export const getStyles = (theme: GrafanaTheme2) => {
  const narrowScreenQuery = theme.breakpoints.down('md');

  return {
    form: css({
      label: 'template-form',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }),
    fieldset: css({
      label: 'template-fieldset',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
    }),
    label: css({
      margin: 0,
    }),
    nameField: css({
      marginBottom: theme.spacing(3),
    }),
    contentContainer: css({
      flex: 1,
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(1),
      '& > *': {
        borderRadius: theme.shape.radius.default,
        border: `1px solid ${theme.colors.border.strong}`,
        [narrowScreenQuery]: {
          minHeight: theme.spacing(40),
        },
      },
      [narrowScreenQuery]: {
        flexDirection: 'column',
        gap: theme.spacing(2),
        height: 'auto',
        maxHeight: 'unset',
      },
    }),
    contentField: css({
      display: 'flex',
      flexDirection: 'column',
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
      [narrowScreenQuery]: {
        display: 'none',
      },
    }),
    snippets: css`
      margin-top: ${theme.spacing(2)};
      font-size: ${theme.typography.bodySmall.fontSize};
    `,
    code: css`
      color: ${theme.colors.text.secondary};
      font-weight: ${theme.typography.fontWeightBold};
    `,
  };
};
