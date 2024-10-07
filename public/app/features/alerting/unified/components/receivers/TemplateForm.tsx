import { css, cx } from '@emotion/css';
import { addMinutes, subDays, subHours } from 'date-fns';
import { Location } from 'history';
import { useMemo, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useToggle } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { config as runtimeConfig, isFetchError, locationService } from '@grafana/runtime';
import {
  Alert,
  Button,
  FieldSet,
  Input,
  LinkButton,
  useStyles2,
  Stack,
  useSplitter,
  Drawer,
  InlineField,
  Box,
} from '@grafana/ui';
import { usePageToolbar } from 'app/core/components/Page/Page';
import { useAppNotification } from 'app/core/copy/appNotification';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { ActiveTab as ContactPointsActiveTabs } from 'app/features/alerting/unified/components/contact-points/ContactPoints';
import { TestTemplateAlert } from 'app/plugins/datasource/alertmanager/types';

import { AppChromeUpdate } from '../../../../../core/components/AppChrome/AppChromeUpdate';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { makeAMLink, stringifyErrorLike } from '../../utils/misc';
import { initialAsyncRequestState } from '../../utils/redux';
import { ProvisionedResource, ProvisioningAlert } from '../Provisioning';
import { EditorColumnHeader } from '../contact-points/templates/EditorColumnHeader';
import {
  NotificationTemplate,
  useCreateNotificationTemplate,
  useNotificationTemplateMetadata,
  useUpdateNotificationTemplate,
  useValidateNotificationTemplate,
} from '../contact-points/useNotificationTemplates';

import { PayloadEditor } from './PayloadEditor';
import { TemplateDataDocs } from './TemplateDataDocs';
import { TemplateEditor } from './TemplateEditor';
import { TemplatePreview } from './TemplatePreview';
import { snippets } from './editor/templateDataSuggestions';

export interface TemplateFormValues {
  title: string;
  content: string;
}

export const defaults: TemplateFormValues = Object.freeze({
  title: '',
  content: '',
});

interface Props {
  originalTemplate?: NotificationTemplate;
  prefill?: TemplateFormValues;
  alertmanager: string;
}

export const isDuplicating = (location: Location) => location.pathname.endsWith('/duplicate');

/**
 * We're going for this type of layout, but with the ability to resize the columns.
 * To achieve this, we're using the useSplitter hook from Grafana UI twice.
 * The first hook is for the vertical splitter between the template editor and the payload editor.
 * The second hook is for the horizontal splitter between the template editor and the preview.
 * If we're using a vanilla Alertmanager source, we don't show the payload editor nor the preview but we still use the splitter at 100/0.
 *
 * ┌───────────────────┐┌───────────┐
 * │ Template          ││ Preview   │
 * │                   ││           │
 * │                   ││           │
 * │                   ││           │
 * └───────────────────┘│           │
 * ┌───────────────────┐│           │
 * │ Payload           ││           │
 * │                   ││           │
 * │                   ││           │
 * │                   ││           │
 * └───────────────────┘└───────────┘
 */
export const TemplateForm = ({ originalTemplate, prefill, alertmanager }: Props) => {
  const styles = useStyles2(getStyles);

  const appNotification = useAppNotification();

  const createNewTemplate = useCreateNotificationTemplate({ alertmanager });
  const updateTemplate = useUpdateNotificationTemplate({ alertmanager });
  const { titleIsUnique } = useValidateNotificationTemplate({ alertmanager });

  useCleanup((state) => (state.unifiedAlerting.saveAMConfig = initialAsyncRequestState));
  const formRef = useRef<HTMLFormElement>(null);
  const isGrafanaAlertManager = alertmanager === GRAFANA_RULES_SOURCE_NAME;

  const { error } = useUnifiedAlertingSelector((state) => state.saveAMConfig);

  const [cheatsheetOpened, toggleCheatsheetOpened] = useToggle(false);

  const [payload, setPayload] = useState(defaultPayloadString);
  const [payloadFormatError, setPayloadFormatError] = useState<string | null>(null);

  const { isProvisioned } = useNotificationTemplateMetadata(originalTemplate);
  const originalTemplatePrefill: TemplateFormValues | undefined = originalTemplate
    ? { title: originalTemplate.title, content: originalTemplate.content }
    : undefined;

  // splitter for template and payload editor
  const columnSplitter = useSplitter({
    direction: 'column',
    // if Grafana Alertmanager, split 50/50, otherwise 100/0 because there is no payload editor
    initialSize: isGrafanaAlertManager ? 0.5 : 1,
    dragPosition: 'middle',
  });

  // splitter for template editor and preview
  const rowSplitter = useSplitter({
    direction: 'row',
    // if Grafana Alertmanager, split 60/40, otherwise 100/0 because there is no preview
    initialSize: isGrafanaAlertManager ? 0.6 : 1,
    dragPosition: 'middle',
  });

  const formApi = useForm<TemplateFormValues>({
    mode: 'onSubmit',
    defaultValues: prefill ?? originalTemplatePrefill ?? defaults,
  });
  const {
    handleSubmit,
    register,
    formState: { errors, isSubmitting },
    getValues,
    setValue,
    watch,
  } = formApi;

  const submit = async (values: TemplateFormValues) => {
    const returnLink = makeAMLink('/alerting/notifications', alertmanager, {
      tab: ContactPointsActiveTabs.NotificationTemplates,
    });

    try {
      if (!originalTemplate) {
        await createNewTemplate({ templateValues: values });
      } else {
        await updateTemplate({ template: originalTemplate, patch: values });
      }
      appNotification.success('Template saved', `Template ${values.title} has been saved`);
      locationService.push(returnLink);
    } catch (error) {
      appNotification.error('Error saving template', stringifyErrorLike(error));
    }
  };

  const actionButtons = useMemo(
    () => (
      <Stack>
        <Button onClick={() => formRef.current?.requestSubmit()} variant="primary" size="sm" disabled={isSubmitting}>
          Save
        </Button>
        <LinkButton
          disabled={isSubmitting}
          href={makeAMLink('alerting/notifications', alertmanager, {
            tab: ContactPointsActiveTabs.NotificationTemplates,
          })}
          variant="secondary"
          size="sm"
        >
          Cancel
        </LinkButton>
      </Stack>
    ),
    [alertmanager, isSubmitting]
  );

  usePageToolbar(actionButtons);

  return (
    <>
      <FormProvider {...formApi}>
        {!runtimeConfig.featureToggles.singleTopNav && <AppChromeUpdate actions={actionButtons} />}
        <form onSubmit={handleSubmit(submit)} ref={formRef} className={styles.form} aria-label="Template form">
          {/* error message */}
          {error && (
            <Alert severity="error" title="Error saving template">
              {error.message || (isFetchError(error) && error.data?.message) || String(error)}
            </Alert>
          )}
          {/* warning about provisioned template */}
          {isProvisioned && (
            <Box grow={0}>
              <ProvisioningAlert resource={ProvisionedResource.Template} />
            </Box>
          )}

          {/* name field for the template */}
          <FieldSet disabled={isProvisioned} className={styles.fieldset}>
            <InlineField
              label="Template name"
              error={errors?.title?.message}
              invalid={!!errors.title?.message}
              required
              className={styles.nameField}
            >
              <Input
                {...register('title', {
                  required: { value: true, message: 'Required.' },
                  validate: { titleIsUnique },
                })}
                placeholder="Give your template a title"
                width={42}
                autoFocus={true}
                id="new-template-name"
              />
            </InlineField>

            {/* editor layout */}
            <div {...rowSplitter.containerProps} className={styles.contentContainer}>
              <div {...rowSplitter.primaryProps}>
                {/* template content and payload editor column – full height and half-width */}
                <div {...columnSplitter.containerProps} className={styles.contentField}>
                  {/* template editor */}
                  <div {...columnSplitter.primaryProps}>
                    {/* primaryProps will set "minHeight: min-content;" so we have to make sure to apply minHeight to the child */}
                    <div className={cx(styles.flexColumn, styles.containerWithBorderAndRadius, styles.minEditorSize)}>
                      <EditorColumnHeader
                        label="Template"
                        actions={
                          <Button
                            icon="question-circle"
                            size="sm"
                            fill="outline"
                            variant="secondary"
                            onClick={toggleCheatsheetOpened}
                          >
                            Help
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
                              width={width}
                              height={height}
                            />
                          )}
                        </AutoSizer>
                      </Box>
                    </div>
                  </div>
                  {/* payload editor – only available for Grafana Alertmanager */}
                  {isGrafanaAlertManager && (
                    <>
                      <div {...columnSplitter.splitterProps} />
                      <div {...columnSplitter.secondaryProps}>
                        <div
                          className={cx(
                            styles.containerWithBorderAndRadius,
                            styles.minEditorSize,
                            styles.payloadEditor,
                            styles.flexFull
                          )}
                        >
                          <PayloadEditor
                            payload={payload}
                            defaultPayload={defaultPayloadString}
                            setPayload={setPayload}
                            setPayloadFormatError={setPayloadFormatError}
                            payloadFormatError={payloadFormatError}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              {/* preview column – full height and half-width */}
              {isGrafanaAlertManager && (
                <>
                  <div {...rowSplitter.secondaryProps}>
                    <div {...rowSplitter.splitterProps}></div>
                    <TemplatePreview
                      payload={payload}
                      templateName={watch('title')}
                      setPayloadFormatError={setPayloadFormatError}
                      payloadFormatError={payloadFormatError}
                      className={cx(styles.templatePreview, styles.minEditorSize)}
                    />
                  </div>
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
    flexFull: css({
      flex: 1,
    }),
    minEditorSize: css({
      minHeight: 300,
      minWidth: 300,
    }),
    payloadEditor: css({
      minHeight: 0,
    }),
    containerWithBorderAndRadius: css({
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.medium}`,
    }),
    flexColumn: css({
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
    }),
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
      marginBottom: theme.spacing(1),
    }),
    contentContainer: css({
      flex: 1,
      display: 'flex',
      flexDirection: 'row',
    }),
    contentField: css({
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      marginBottom: 0,
    }),
    templatePreview: css({
      flex: 1,
      display: 'flex',
    }),
    templatePayload: css({
      flex: 1,
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
    snippets: css({
      marginTop: theme.spacing(2),
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    code: css({
      color: theme.colors.text.secondary,
      fontWeight: theme.typography.fontWeightBold,
    }),
  };
};

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

export const defaultPayloadString = JSON.stringify(defaultPayload, null, 2);
