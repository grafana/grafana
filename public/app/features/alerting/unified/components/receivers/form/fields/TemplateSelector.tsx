import { css, cx } from '@emotion/css';
import React, { PropsWithChildren, useEffect, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { useCopyToClipboard } from 'react-use';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import {
  Button,
  Drawer,
  IconButton,
  Input,
  RadioButtonGroup,
  Select,
  Stack,
  Text,
  TextArea,
  useStyles2,
} from '@grafana/ui';
import {
  trackEditInputWithTemplate,
  trackUseCustomInputInTemplate,
  trackUseSingleTemplateInInput,
} from 'app/features/alerting/unified/Analytics';
import { templatesApi } from 'app/features/alerting/unified/api/templateApi';
import { useAlertmanagerConfig } from 'app/features/alerting/unified/hooks/useAlertmanagerConfig';
import { useAlertmanager } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { NotificationChannelOption } from 'app/types';

import { defaultPayloadString } from '../../TemplateForm';

import { TemplateContentAndPreview } from './TemplateContentAndPreview';

interface TemplatesPickerProps {
  onSelect: (temnplate: string) => void;
  option: NotificationChannelOption;
  valueInForm: string;
}
export function TemplatesPicker({ onSelect, option, valueInForm }: TemplatesPickerProps) {
  const [showTemplates, setShowTemplates] = React.useState(false);
  const onClick = () => {
    setShowTemplates(true);
    trackEditInputWithTemplate();
  };
  return (
    <>
      <Button
        icon="edit"
        tooltip={'Edit using existing templates.'}
        onClick={onClick}
        variant="secondary"
        size="sm"
        aria-label={'Select available template from the list of available templates.'}
      >
        {`Edit ${option.label}`}
      </Button>

      {showTemplates && (
        <Drawer title={`Edit ${option.label}`} size="md" onClose={() => setShowTemplates(false)}>
          <TemplateSelector
            onSelect={onSelect}
            onClose={() => setShowTemplates(false)}
            option={option}
            valueInForm={valueInForm}
          />
        </Drawer>
      )}
    </>
  );
}

type TemplateFieldOption = 'Existing' | 'Custom';

/**
 * This function parses the template content and returns an array of Template objects.
 * Each Template object represents a single template definition found in the content.
 *
 * There are several rules for parsing the template content:
 * - The template content may use the "-" symbol for whitespace trimming. If a template's left delimiter ("{{")
 *   is immediately followed by a "-" and whitespace, all trailing whitespace is removed from the preceding text.
 * - Similarly, if the right delimiter ("}}") is immediately preceded by whitespace and a "-", all leading whitespace
 *  is removed from the following text. In these cases, the whitespace must be present for the trimming to occur.
 * - The template content may contain nested templates. The nested templates are appended to the main template content,
 *  and the nested templates are removed from the list of templates.
 * - We don't return templates with names starting with "__" as they are considered internal templates.
 *
 * @param templatesString is a string containing the template content. Each template is defined within
 * "{{ define "templateName" }}" and "{{ end }}" delimiters.But it may also contain nested templates.
 */

export function parseTemplates(templatesString: string): Template[] {
  const templates: Record<string, Template> = {};
  const stack: Array<{ type: string; startIndex: number; name?: string }> = [];
  const regex = /{{(-?\s*)(define|end|if|range|else|with|template)(\s*.*?)?(-?\s*)}}/gs;

  let match;
  let currentIndex = 0;

  while ((match = regex.exec(templatesString)) !== null) {
    const [, , keyword, middleContent] = match;
    currentIndex = match.index;

    if (keyword === 'define') {
      const nameMatch = middleContent?.match(/"([^"]+)"/);
      if (nameMatch) {
        stack.push({ type: 'define', startIndex: currentIndex, name: nameMatch[1] });
      }
    } else if (keyword === 'end') {
      let top = stack.pop();
      while (top && top.type !== 'define' && top.type !== 'if' && top.type !== 'range' && top.type !== 'with') {
        top = stack.pop();
      }
      if (top) {
        const endIndex = regex.lastIndex;
        if (top.type === 'define' && !top.name?.startsWith('__')) {
          templates[top.name!] = {
            name: top.name!,
            content: templatesString.slice(top.startIndex, endIndex),
          };
        }
      }
    } else if (keyword === 'if' || keyword === 'range' || keyword === 'else' || keyword === 'with') {
      stack.push({ type: keyword, startIndex: currentIndex });
    }
  }
  // Append sub-template content to the end of the main template and remove sub-templates from the list
  for (const template of Object.values(templates)) {
    template.content.replace(/{{ template "([^"]+)" }}/g, (_, name) => {
      if (templates[name]?.content) {
        template.content += '\n' + templates[name]?.content;
        delete templates[name]; // Remove the sub-template from the list
      }
      return '';
    });
  }

  return Object.values(templates);
}

export function getTemplateOptions(templateFiles: Record<string, string>, defaultTemplates: Template[] = []) {
  // Add default templates
  const templateMap = new Map<string, SelectableValue<Template>>();
  Object.entries(templateFiles).forEach(([_, content]) => {
    const templates: Template[] = parseTemplates(content);
    templates.forEach((template) => {
      templateMap.set(template.name, {
        label: template.name,
        value: {
          name: template.name,
          content: template.content,
        },
      });
    });
  });
  // Add default templates to the map
  defaultTemplates.forEach((template) => {
    templateMap.set(template.name, {
      label: template.name,
      value: {
        name: template.name,
        content: template.content,
      },
    });
  });
  // return the sum of default and custom templates
  return Array.from(templateMap.values());
}

export interface Template {
  name: string;
  content: string;
}
interface TemplateSelectorProps {
  onSelect: (template: string) => void;
  onClose: () => void;
  option: NotificationChannelOption;
  valueInForm: string;
}
function TemplateSelector({ onSelect, onClose, option, valueInForm }: TemplateSelectorProps) {
  const styles = useStyles2(getStyles);
  const useGetDefaultTemplatesQuery = templatesApi.endpoints.getDefaultTemplates.useQuery;
  const [template, setTemplate] = React.useState<Template | undefined>(undefined);
  const [inputToUpdate, setInputToUpdate] = React.useState<string>('');
  const [inputToUpdateCustom, setInputToUpdateCustom] = React.useState<string>(valueInForm);

  const { selectedAlertmanager } = useAlertmanager();
  const { data, error } = useAlertmanagerConfig(selectedAlertmanager);
  const { data: defaultTemplates } = useGetDefaultTemplatesQuery();
  const [templateOption, setTemplateOption] = React.useState<TemplateFieldOption>('Existing');
  const [_, copyToClipboard] = useCopyToClipboard();

  const templateOptions: Array<SelectableValue<TemplateFieldOption>> = [
    { label: 'Selecting existing template', value: 'Existing' },
    { label: `Enter custom ${option.label}`, value: 'Custom' },
  ];

  useEffect(() => {
    if (template) {
      setInputToUpdate(getUseTemplateText(template.name));
    }
  }, [template]);

  function onCustomTemplateChange(customInput: string) {
    setInputToUpdateCustom(customInput);
  }

  const onTemplateOptionChange = (option: TemplateFieldOption) => {
    setTemplateOption(option);
  };

  const options = useMemo(() => {
    if (!defaultTemplates) {
      return [];
    }
    return getTemplateOptions(data?.template_files ?? {}, defaultTemplates);
  }, [data, defaultTemplates]);

  if (error) {
    return <div>Error loading templates</div>;
  }

  if (!data) {
    return <div>Loading...</div>;
  }

  return (
    <Stack direction="column" gap={1} justifyContent="space-between" height="100%">
      <Stack direction="column" gap={1}>
        <RadioButtonGroup
          options={templateOptions}
          value={templateOption}
          onChange={onTemplateOptionChange}
          className={styles.templateTabOption}
        />

        {templateOption === 'Existing' ? (
          <Stack direction="column" gap={1}>
            <Stack direction="row" gap={1} alignItems="center">
              <Select<Template>
                aria-label="Template"
                onChange={(value: SelectableValue<Template>, _) => {
                  setTemplate(value?.value);
                }}
                options={options}
                width={50}
              />
              <IconButton
                tooltip="Copy selected template to clipboard. You can use it in the custom tab."
                onClick={() => copyToClipboard(getUseTemplateText(template?.name ?? ''))}
                name="copy"
              />
            </Stack>

            <TemplateContentAndPreview
              templateContent={template?.content ?? ''}
              payload={defaultPayloadString}
              templateName={template?.name ?? ''}
              setPayloadFormatError={() => {}}
              className={cx(styles.templatePreview, styles.minEditorSize)}
              payloadFormatError={null}
            />
          </Stack>
        ) : (
          <OptionCustomfield
            option={option}
            onCustomTemplateChange={onCustomTemplateChange}
            initialValue={inputToUpdateCustom}
          />
        )}
      </Stack>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            onSelect(templateOption === 'Custom' ? inputToUpdateCustom : inputToUpdate);
            onClose();
            if (templateOption === 'Custom') {
              trackUseCustomInputInTemplate();
            } else {
              trackUseSingleTemplateInInput();
            }
          }}
        >
          Save
        </Button>
      </div>
    </Stack>
  );
}

function OptionCustomfield({
  option,
  onCustomTemplateChange,
  initialValue,
}: {
  option: NotificationChannelOption;
  onCustomTemplateChange(customInput: string): void;
  initialValue: string;
}) {
  switch (option.element) {
    case 'textarea':
      return (
        <Stack direction="row" gap={1} alignItems="center">
          <TextArea
            placeholder={option.placeholder}
            onChange={(e) => onCustomTemplateChange(e.currentTarget.value)}
            defaultValue={initialValue}
          />
        </Stack>
      );
    case 'input':
      return (
        <Stack direction="row" gap={1} alignItems="center">
          <Input
            type={option.inputType}
            placeholder={option.placeholder}
            onChange={(e) => onCustomTemplateChange(e.currentTarget.value)}
            defaultValue={initialValue}
          />
        </Stack>
      );
    default:
      return null;
  }
}

function getUseTemplateText(templateName: string) {
  return `{{ template "${templateName}" . }}`;
}

function getTemplateName(useTemplateText: string): string | null {
  const match = useTemplateText.match(/\{\{\s*template\s*"(.*)"\s*\.\s*\}\}/);
  return match ? match[1] : null;
}
function matchesOnlyOneTemplate(templateContent: string) {
  const pattern = /\{\{\s*template\s*".*?"\s*\.\s*\}\}/g;
  const matches = templateContent.match(pattern);
  return matches && matches.length === 1;
}

interface WrapWithTemplateSelectionProps extends PropsWithChildren {
  useTemplates: boolean;
  onSelectTemplate: (template: string) => void;
  option: NotificationChannelOption;
  name: string;
}
export function WrapWithTemplateSelection({
  useTemplates,
  onSelectTemplate,
  option,
  name,
  children,
}: WrapWithTemplateSelectionProps) {
  const { getValues } = useFormContext();
  const value: string = getValues(name) ?? '';
  const emptyValue = value === '' || value === undefined;
  const onlyOneTemplate = value ? matchesOnlyOneTemplate(value) : false;
  const styles = useStyles2(getStyles);

  // if the placeholder does not contain a template, we don't need to show the template picker
  if (!option.placeholder.includes('{{ template ')) {
    return <>{children}</>;
  }
  // Otherwise, we can use templates on this field

  // if the value is empty, we only show the template picker
  if (emptyValue) {
    return (
      <div className={styles.inputContainer}>
        <Stack direction="row" gap={1} alignItems="center">
          {useTemplates && (
            <TemplatesPicker onSelect={onSelectTemplate} option={option} valueInForm={getValues(name) ?? ''} />
          )}
        </Stack>
      </div>
    );
  }
  if (onlyOneTemplate) {
    return (
      <div className={styles.inputContainer}>
        <Stack direction="row" gap={1} alignItems="center">
          <Text variant="bodySmall">{`Template: ${getTemplateName(value)}`}</Text>
          {useTemplates && (
            <TemplatesPicker onSelect={onSelectTemplate} option={option} valueInForm={getValues(name) ?? ''} />
          )}
        </Stack>
      </div>
    );
  }
  // custom template  field
  return (
    <div className={styles.inputContainer}>
      <Stack direction="row" gap={1} alignItems="center">
        {children}
        {useTemplates && (
          <TemplatesPicker onSelect={onSelectTemplate} option={option} valueInForm={getValues(name) ?? ''} />
        )}
      </Stack>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  actions: css({
    flex: 0,
    justifyContent: 'flex-end',
    display: 'flex',
    gap: theme.spacing(1),
  }),
  templatePreview: css({
    flex: 1,
    display: 'flex',
  }),
  templateTabOption: css({
    width: 'fit-content',
  }),
  minEditorSize: css({
    minHeight: 300,
    minWidth: 300,
  }),
  inputContainer: css({
    marginTop: theme.spacing(1.5),
  }),
});
