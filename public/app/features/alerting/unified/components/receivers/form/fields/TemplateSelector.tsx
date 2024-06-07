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
import { getTemplateName, getUseTemplateText, matchesOnlyOneTemplate, parseTemplates } from './utils';

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
function getContentFromOptions(name: string, options: Array<SelectableValue<Template>>) {
  const template = options.find((option) => option.label === name);
  return template?.value?.content ?? '';
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
    {
      label: 'Selecting existing template',
      value: 'Existing',
      description: `Select a single template and preview it, or copy it to paste it in the custom tab. ${templateOption === 'Existing' ? 'Clicking Save will save your changes to the selected template.' : ''}`,
    },
    {
      label: `Enter custom ${option.label.toLowerCase()}`,
      value: 'Custom',
      description: `Enter custom ${option.label.toLowerCase()}. ${templateOption === 'Custom' ? 'Clicking Save will save the custom value only.' : ''}`,
    },
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

  // if we are using only one template, we should settemplate to that template
  useEffect(() => {
    if (Boolean(valueInForm)) {
      if (matchesOnlyOneTemplate(valueInForm)) {
        const name = getTemplateName(valueInForm);
        setTemplate({
          name,
          content: getContentFromOptions(name, options),
        });
      } else {
        // if it's empty we default to select existing template
        setTemplateOption('Custom');
      }
    }
  }, [valueInForm, setTemplate, setTemplateOption, options]);

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
                value={template ? { label: template.name, value: template } : undefined}
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
  const styles = useStyles2(getStyles);
  const { getValues } = useFormContext();
  const value = getValues(name) ?? '';
  // if the placeholder does not contain a template, we don't need to show the template picker
  if (!option.placeholder.includes('{{ template ') || typeof value !== 'string') {
    return <>{children}</>;
  }
  // Otherwise, we can use templates on this field
  // if the value is empty, we only show the template picker
  if (!value) {
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
  const onlyOneTemplate = value ? matchesOnlyOneTemplate(value) : false;
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
