import { css, cx } from '@emotion/css';
import { addMinutes, subDays, subHours } from 'date-fns';
import { Location } from 'history';
import { useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useToggle } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { isFetchError, locationService } from '@grafana/runtime';
import {
  Alert,
  Box,
  Button,
  Drawer,
  Dropdown,
  FieldSet,
  InlineField,
  Input,
  LinkButton,
  Menu,
  Stack,
  Text,
  useSplitter,
  useStyles2,
} from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { ActiveTab as ContactPointsActiveTabs } from 'app/features/alerting/unified/components/contact-points/ContactPoints';
import { TestTemplateAlert } from 'app/plugins/datasource/alertmanager/types';

import { AITemplateButtonComponent } from '../../enterprise-components/AI/AIGenTemplateButton/addAITemplateButton';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { makeAMLink, stringifyErrorLike } from '../../utils/misc';
import { ProvisionedResource, ProvisioningAlert } from '../Provisioning';
import { Spacer } from '../Spacer';
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
import { GlobalTemplateDataExamples } from './TemplateDataExamples';
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

  const [createNewTemplate, { error: createTemplateError }] = useCreateNotificationTemplate({ alertmanager });
  const [updateTemplate, { error: updateTemplateError }] = useUpdateNotificationTemplate({ alertmanager });
  const { titleIsUnique } = useValidateNotificationTemplate({ alertmanager, originalTemplate });

  const formRef = useRef<HTMLFormElement>(null);
  const isGrafanaAlertManager = alertmanager === GRAFANA_RULES_SOURCE_NAME;

  const error = updateTemplateError ?? createTemplateError;

  const [cheatsheetOpened, toggleCheatsheetOpened] = useToggle(false);

  const [payload, setPayload] = useState(defaultPayloadString);
  const [payloadFormatError, setPayloadFormatError] = useState<string | null>(null);

  // AI feedback state
  const [aiGeneratedTemplate, setAiGeneratedTemplate] = useState(false);

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
        await createNewTemplate.execute({ templateValues: values });
      } else {
        await updateTemplate.execute({ template: originalTemplate, patch: values });
      }
      appNotification.success('Template saved', `Template ${values.title} has been saved`);
      locationService.push(returnLink);
    } catch (error) {
      appNotification.error('Error saving template', stringifyErrorLike(error));
    }
  };

  const appendExample = (example: string) => {
    const content = getValues('content'),
      newValue = !content ? example : `${content}\n${example}`;
    setValue('content', newValue);
  };

  const handleTemplateGenerated = (template: string) => {
    setValue('content', template);
    setAiGeneratedTemplate(true);
  };

  return (
    <>
      <FormProvider {...formApi}>
        <form
          onSubmit={handleSubmit(submit)}
          ref={formRef}
          className={styles.form}
          aria-label={t('alerting.template-form.aria-label-template-form', 'Template form')}
        >
          {/* error message */}
          {error && (
            <Alert
              severity="error"
              title={t('alerting.template-form.title-error-saving-template', 'Error saving template')}
            >
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
            <Stack direction="column" gap={1} alignItems="stretch" minHeight="100%">
              {/* name and save buttons */}
              <Stack direction="row" alignItems="center">
                <InlineField
                  label={t('alerting.template-form.label-template-group-name', 'Template group name')}
                  error={errors?.title?.message}
                  invalid={!!errors.title?.message}
                  required
                >
                  <Input
                    {...register('title', {
                      required: { value: true, message: t('alerting.template-form.message.required', 'Required.') },
                      validate: { titleIsUnique },
                    })}
                    placeholder={t(
                      'alerting.template-form.new-template-name-placeholder-give-your-template-group-a-name',
                      'Give your template group a name'
                    )}
                    width={42}
                    autoFocus={true}
                    id="new-template-name"
                  />
                </InlineField>
                <Spacer />
                <Stack>
                  <Button onClick={() => formRef.current?.requestSubmit()} variant="primary" disabled={isSubmitting}>
                    <Trans i18nKey="common.save">Save</Trans>
                  </Button>
                  <LinkButton
                    disabled={isSubmitting}
                    href={makeAMLink('alerting/notifications', alertmanager, {
                      tab: ContactPointsActiveTabs.NotificationTemplates,
                    })}
                    variant="secondary"
                  >
                    <Trans i18nKey="common.cancel">Cancel</Trans>
                  </LinkButton>
                </Stack>
              </Stack>

              {/* editor layout */}
              <div {...rowSplitter.containerProps} className={styles.contentContainer}>
                <div {...rowSplitter.primaryProps}>
                  {/* template content and payload editor column – full height and half-width */}
                  <div {...columnSplitter.containerProps} className={styles.contentField}>
                    {/* template editor */}
                    <div {...columnSplitter.primaryProps}>
                      {/* primaryProps will set "minHeight: min-content;" so we have to make sure to apply minHeight to the child */}
                      <div className={cx(styles.flexColumn, styles.containerWithBorderAndRadius, styles.minEditorSize)}>
                        <div>
                          <EditorColumnHeader
                            label={t('alerting.template-form.label-template-group', 'Template group')}
                            actions={
                              <>
                                {/* examples dropdown – only available for Grafana Alertmanager */}
                                {isGrafanaAlertManager && (
                                  <Dropdown
                                    overlay={
                                      <Menu>
                                        {GlobalTemplateDataExamples.map((item, index) => (
                                          <Menu.Item
                                            key={index}
                                            label={item.description}
                                            onClick={() => appendExample(item.example)}
                                          />
                                        ))}
                                        <Menu.Divider />
                                        <Menu.Item
                                          label={t(
                                            'alerting.template-form.label-examples-documentation',
                                            'Examples documentation'
                                          )}
                                          url="https://grafana.com/docs/grafana/latest/alerting/configure-notifications/template-notifications/examples/"
                                          target="_blank"
                                          icon="external-link-alt"
                                        />
                                      </Menu>
                                    }
                                  >
                                    <Button variant="secondary" size="sm" icon="angle-down">
                                      <Trans i18nKey="alerting.templates.editor.add-example">Add example</Trans>
                                    </Button>
                                  </Dropdown>
                                )}
                                {/* GenAI button – only available for Grafana Alertmanager and enterprise */}
                                {isGrafanaAlertManager && (
                                  <AITemplateButtonComponent
                                    onTemplateGenerated={handleTemplateGenerated}
                                    disabled={isProvisioned}
                                  />
                                )}
                                <Button
                                  icon="question-circle"
                                  size="sm"
                                  fill="outline"
                                  variant="secondary"
                                  onClick={toggleCheatsheetOpened}
                                >
                                  <Trans i18nKey="common.help">Help</Trans>
                                </Button>
                              </>
                            }
                          />
                        </div>
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
                  <div {...rowSplitter.secondaryProps}>
                    <div {...rowSplitter.splitterProps} />
                    <TemplatePreview
                      payload={payload}
                      templateName={watch('title')}
                      templateContent={watch('content')}
                      setPayloadFormatError={setPayloadFormatError}
                      payloadFormatError={payloadFormatError}
                      className={cx(styles.templatePreview, styles.minEditorSize)}
                      aiGeneratedTemplate={aiGeneratedTemplate}
                      setAiGeneratedTemplate={setAiGeneratedTemplate}
                    />
                  </div>
                )}
              </div>
            </Stack>
          </FieldSet>
        </form>
      </FormProvider>
      {cheatsheetOpened && (
        <Drawer
          title={t('alerting.template-form.title-templating-cheat-sheet', 'Templating cheat sheet')}
          onClose={toggleCheatsheetOpened}
          size="lg"
        >
          <TemplatingCheatSheet />
        </Drawer>
      )}
    </>
  );
};

function TemplatingBasics() {
  const styles = useStyles2(getStyles);

  const intro = t(
    'alerting.templates.help.intro',
    `Notification templates use Go templating language to create notification messages.

In Grafana, a template group can define multiple notification templates using {{ define "<NAME>" }}.
These templates can then be used in contact points and within other notification templates by calling {{ template "<NAME>" }}.
For detailed information about notification templates, refer to our documentation.`
  );

  return (
    <Alert title="" severity="info">
      <Stack direction="column" gap={2}>
        <Stack direction="row">
          <div style={{ whiteSpace: 'pre' }}>{intro}</div>
          <div>
            <LinkButton
              href="https://grafana.com/docs/grafana/latest/alerting/manage-notifications/template-notifications/"
              target="_blank"
              icon="external-link-alt"
              variant="secondary"
            >
              <Trans i18nKey="alerting.templates.editor.goto-docs">Notification templates documentation</Trans>
            </LinkButton>
          </div>
        </Stack>

        <Text variant="bodySmall">
          <Trans i18nKey="alerting.templates.editor.auto-complete">
            For auto-completion of common templating code, type the following keywords in the content editor:
          </Trans>
          <div className={styles.code}>
            {Object.values(snippets)
              .map((s) => s.label)
              .join(', ')}
          </div>
        </Text>
      </Stack>
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
