import { css, cx } from '@emotion/css';
import { addMinutes, subDays, subHours } from 'date-fns';
import { Location } from 'history';
import { useCallback, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useToggle } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { llm } from '@grafana/llm';
import { isFetchError, locationService } from '@grafana/runtime';
import {
  Alert,
  Box,
  Button,
  Drawer,
  Dropdown,
  Field,
  FieldSet,
  InlineField,
  Input,
  LinkButton,
  Menu,
  Modal,
  Stack,
  Text,
  TextArea,
  useSplitter,
  useStyles2,
} from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { ActiveTab as ContactPointsActiveTabs } from 'app/features/alerting/unified/components/contact-points/ContactPoints';
import { DEFAULT_LLM_MODEL, Message, sanitizeReply } from 'app/features/dashboard/components/GenAI/utils';
import { TestTemplateAlert } from 'app/plugins/datasource/alertmanager/types';

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

// Tool definition for getting template examples and data
const GET_TEMPLATE_EXAMPLES_TOOL = {
  type: 'function' as const,
  function: {
    name: 'get_template_examples',
    description:
      'Retrieves available notification template examples and data structure information to help generate template content',
    parameters: {
      type: 'object',
      properties: {
        includeDataStructure: {
          type: 'boolean',
          description: 'Whether to include information about available template data fields',
          default: true,
        },
      },
      required: [],
    },
  },
};

const SYSTEM_PROMPT_CONTENT = `You are an expert in creating Grafana notification templates using Go templating syntax. Based on the user's description of how they want their notification to look, generate the appropriate Go template content.

You have access to tools that can help you:
- get_template_examples: Use this to retrieve available template examples and data structure

Key information about Grafana notification templates:
- Use Go templating syntax with {{ }} delimiters
- Templates can define multiple named templates using {{ define "templateName" }}...{{ end }}
- ONLY use these basic template functions: range, if, else, end, with, printf, len
- Do NOT use: dict, index, slice, title, toUpper, toLower, html, js, urlquery, humanize, or other advanced functions
- Available data fields include:
  - .Alerts (array of alert objects)
  - .CommonAnnotations (shared annotations)
  - .CommonLabels (shared labels) 
  - .ExternalURL (Grafana external URL)
  - .GroupLabels (grouping labels)
  - .Status (firing/resolved)
  - Each alert has: .Annotations, .Labels, .StartsAt, .EndsAt, .GeneratorURL, .Fingerprint

Template structure guidelines:
- Start with {{ define "templateName" }} and end with {{ end }}
- Use meaningful template names that describe the content type (e.g., "slack.title", "email.body")
- Handle both firing and resolved states using simple {{ if eq .Status "firing" }} conditions
- Include relevant alert information like labels, annotations, and timing
- Use PLAIN TEXT formatting only - no HTML tags
- Use simple conditional logic instead of dictionaries or complex functions
- Use .StartsAt and .EndsAt as-is (they're already formatted timestamps)

Valid patterns to use:
- Iterate through alerts: {{ range .Alerts }}...{{ end }}
- Check status: {{ if eq .Status "firing" }}🔥 FIRING{{ else }}✅ RESOLVED{{ end }}
- Access alert fields: {{ .Labels.alertname }}, {{ .Annotations.summary }}
- Simple conditionals: {{ if .Annotations.summary }}Summary: {{ .Annotations.summary }}{{ end }}

AVOID these invalid patterns:
- dict functions: {{ $statusEmoji := dict "firing" "🚨" }} ❌
- index with variables: {{ index $statusEmoji .Status }} ❌  
- HTML tags: <table>, <tr>, <td> ❌
- Complex variable assignments beyond simple ranges ❌
- title, toUpper, toLower functions ❌

When the user describes their desired notification format, generate simple Go template code using only basic conditionals and loops.

Return only the Go template content, no additional text or explanations.`;

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

  // GenAI state management
  const [showGenAIModal, setShowGenAIModal] = useState(false);
  const [genAIPrompt, setGenAIPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genAIError, setGenAIError] = useState<string | null>(null);

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

  // Tool handler for getting template examples
  const handleGetTemplateExamples = useCallback(async (args: unknown) => {
    try {
      return {
        success: true,
        examples: GlobalTemplateDataExamples.map((item) => ({
          description: item.description,
          template: item.example,
        })),
        dataStructure: {
          alerts: 'Array of alert objects with .Annotations, .Labels, .StartsAt, .EndsAt, .GeneratorURL, .Fingerprint',
          commonAnnotations: 'Shared annotations across all alerts in the group',
          commonLabels: 'Shared labels across all alerts in the group',
          externalURL: 'Grafana external URL',
          groupLabels: 'Labels used for grouping alerts',
          status: 'firing or resolved',
        },
        templateFunctions: [
          'range',
          'if',
          'else',
          'with',
          'printf',
          'title',
          'toUpper',
          'toLower',
          'len',
          'index',
          'slice',
          'html',
          'js',
          'urlquery',
          'humanize',
        ],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        examples: [],
        dataStructure: {},
        templateFunctions: [],
      };
    }
  }, []);

  // Sets up the AI's behavior and context
  const createSystemPrompt = (): Message => ({
    role: 'system',
    content: SYSTEM_PROMPT_CONTENT,
  });

  // Contains the actual user request/query
  const createUserPrompt = (userInput: string): Message => ({
    role: 'user',
    content: `Generate a notification template that produces this kind of output: ${userInput}

Please create a Go template that would generate a notification with the described format, using appropriate alert data fields and template functions.`,
  });

  // Handle LLM call with tools
  const handleGenerateWithTools = useCallback(
    async (messages: Message[]) => {
      setIsGenerating(true);
      setGenAIError(null);

      try {
        const response = await llm.chatCompletions({
          model: DEFAULT_LLM_MODEL,
          messages,
          tools: [GET_TEMPLATE_EXAMPLES_TOOL],
          temperature: 0.3,
        });

        const finalMessages = [...messages];

        // Handle tool calls if present
        if (response.choices[0]?.message?.tool_calls) {
          // Add the assistant's response with tool calls
          finalMessages.push({
            role: 'assistant',
            content: response.choices[0].message.content,
            tool_calls: response.choices[0].message.tool_calls,
          });

          // Process each tool call
          for (const toolCall of response.choices[0].message.tool_calls) {
            if (toolCall.function.name === 'get_template_examples') {
              const args = JSON.parse(toolCall.function.arguments);
              const result = await handleGetTemplateExamples(args);

              // Add the tool result
              finalMessages.push({
                role: 'tool',
                content: JSON.stringify(result),
                tool_call_id: toolCall.id,
              });
            }
          }

          // Call LLM again with the tool results
          const finalResponse = await llm.chatCompletions({
            model: DEFAULT_LLM_MODEL,
            messages: finalMessages,
            tools: [GET_TEMPLATE_EXAMPLES_TOOL],
            temperature: 0.3,
          });

          // Process the final response
          const finalContent = finalResponse.choices[0]?.message?.content;
          if (finalContent) {
            handleParsedResponse(finalContent);
          }
        } else {
          // No tool calls, process the response directly
          const content = response.choices[0]?.message?.content;
          if (content) {
            handleParsedResponse(content);
          }
        }
      } catch (error) {
        console.error('Failed to generate template with LLM:', error);
        setGenAIError('Failed to generate template. Please try again.');
      } finally {
        setIsGenerating(false);
      }
    },
    [handleGetTemplateExamples]
  );

  // Parse and handle the LLM response
  const handleParsedResponse = useCallback(
    (reply: string) => {
      try {
        const sanitizedReply = sanitizeReply(reply);

        // Set the generated template content
        setValue('content', sanitizedReply);
        setShowGenAIModal(false);
      } catch (error) {
        console.error('Failed to parse generated template:', error);
        setGenAIError('Failed to parse the generated template. Please try again.');
      }
    },
    [setValue]
  );

  const handleGenerate = () => {
    if (!genAIPrompt.trim()) {
      return;
    }
    const messages: Message[] = [createSystemPrompt(), createUserPrompt(genAIPrompt)];
    handleGenerateWithTools(messages);
  };

  const handleCloseGenAIModal = () => {
    setShowGenAIModal(false);
    setGenAIPrompt('');
    setGenAIError(null);
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
                                {/* GenAI button – only available for Grafana Alertmanager */}
                                {isGrafanaAlertManager && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    icon="ai"
                                    onClick={() => setShowGenAIModal(true)}
                                    disabled={isProvisioned}
                                  >
                                    <Trans i18nKey="alerting.templates.editor.generate-with-ai">Generate with AI</Trans>
                                  </Button>
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
                    />
                  </div>
                )}
              </div>
            </Stack>
          </FieldSet>
        </form>
      </FormProvider>

      {/* GenAI Modal for template generation */}
      <Modal
        title={t('alerting.template-form.genai.modal.title', 'Generate Template with AI')}
        isOpen={showGenAIModal}
        onDismiss={handleCloseGenAIModal}
        className={styles.genAIModal}
      >
        <Stack direction="column" gap={3}>
          <Field
            label={t(
              'alerting.template-form.genai.modal.prompt-label',
              'Describe how you want your notification to look'
            )}
            description={t(
              'alerting.template-form.genai.modal.prompt-description',
              'Describe the format and content you want for your notification. For example: "A Slack message showing alert name, status, and a summary with emoji indicators" or "An email with a table of all firing alerts including their labels and start times".'
            )}
            noMargin
          >
            <TextArea
              value={genAIPrompt}
              onChange={(e) => setGenAIPrompt(e.currentTarget.value)}
              placeholder={t(
                'alerting.template-form.genai.modal.prompt-placeholder',
                'A Slack message that shows "🔥 ALERT: [AlertName] is firing" with a summary and link to view details...'
              )}
              rows={4}
              disabled={isGenerating}
            />
          </Field>

          {genAIError && (
            <div className={styles.error}>
              <Trans i18nKey="alerting.template-form.genai.modal.error">{genAIError}</Trans>
            </div>
          )}

          <Stack direction="row" justifyContent="flex-end" gap={2}>
            <Button variant="secondary" onClick={handleCloseGenAIModal}>
              <Trans i18nKey="common.cancel">Cancel</Trans>
            </Button>
            <Button
              variant="primary"
              onClick={handleGenerate}
              disabled={!genAIPrompt.trim() || isGenerating}
              icon={isGenerating ? 'spinner' : 'ai'}
            >
              {isGenerating ? (
                <Trans i18nKey="alerting.template-form.genai.modal.generating">Generating...</Trans>
              ) : (
                <Trans i18nKey="alerting.template-form.genai.modal.generate">Generate Template</Trans>
              )}
            </Button>
          </Stack>
        </Stack>
      </Modal>

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
    genAIModal: css({
      width: '50%',
      maxWidth: 600,
    }),
    error: css({
      color: theme.colors.error.text,
      marginBottom: theme.spacing(2),
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
