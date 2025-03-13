import { css, cx } from '@emotion/css';
import { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useCopyToClipboard } from 'react-use';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import {
  Button,
  Drawer,
  IconButton,
  Label,
  RadioButtonGroup,
  Select,
  Stack,
  Text,
  TextArea,
  useStyles2,
} from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import {
  trackEditInputWithTemplate,
  trackUseCustomInputInTemplate,
  trackUseSingleTemplateInInput,
} from 'app/features/alerting/unified/Analytics';
import { templatesApi } from 'app/features/alerting/unified/api/templateApi';
import {
  NotificationTemplate,
  useNotificationTemplates,
} from 'app/features/alerting/unified/components/contact-points/useNotificationTemplates';
import { useAlertmanager } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { NotificationChannelOption } from 'app/types';

import { defaultPayloadString } from '../../TemplateForm';

import { TemplateContentAndPreview } from './TemplateContentAndPreview';
import { getTemplateName, getUseTemplateText, matchesOnlyOneTemplate, parseTemplates } from './utils';

const { useGetDefaultTemplatesQuery } = templatesApi;

interface TemplatesPickerProps {
  onSelect: (temnplate: string) => void;
  option: NotificationChannelOption;
  valueInForm: string;
}
export function TemplatesPicker({ onSelect, option, valueInForm }: TemplatesPickerProps) {
  const [showTemplates, setShowTemplates] = useState(false);
  const onClick = () => {
    setShowTemplates(true);
    trackEditInputWithTemplate();
  };
  const handleClose = () => setShowTemplates(false);

  return (
    <>
      <Button
        icon="edit"
        tooltip={`Edit ${option.label.toLowerCase()} using existing notification templates.`}
        onClick={onClick}
        variant="secondary"
        size="sm"
      >
        {`Edit ${option.label}`}
      </Button>

      {showTemplates && (
        <Drawer title={`Edit ${option.label}`} size="md" onClose={handleClose}>
          <TemplateSelector onSelect={onSelect} onClose={handleClose} option={option} valueInForm={valueInForm} />
        </Drawer>
      )}
    </>
  );
}

type TemplateFieldOption = 'Existing' | 'Custom';

export function getTemplateOptions(templateFiles: NotificationTemplate[], defaultTemplates: Template[] = []) {
  // Add default templates
  const templateMap = new Map<string, SelectableValue<Template>>();
  templateFiles.forEach(({ content }) => {
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
  const valueInFormIsCustom = Boolean(valueInForm) && !matchesOnlyOneTemplate(valueInForm);
  const [template, setTemplate] = useState<SelectableValue<Template> | undefined>(undefined);
  const [customTemplateValue, setCustomTemplateValue] = useState<string>(valueInForm);

  const { selectedAlertmanager } = useAlertmanager();
  const { data = [], error, isLoading } = useNotificationTemplates({ alertmanager: selectedAlertmanager! });
  const { data: defaultTemplates } = useGetDefaultTemplatesQuery();
  const [templateOption, setTemplateOption] = useState<TemplateFieldOption | undefined>(
    valueInFormIsCustom ? 'Custom' : 'Existing'
  );
  const [_, copyToClipboard] = useCopyToClipboard();

  const templateOptions: Array<SelectableValue<TemplateFieldOption>> = [
    {
      label: 'Select notification template',
      ariaLabel: 'Select notification template',
      value: 'Existing',
      description: `Select an existing notification template and preview it, or copy it to paste it in the custom tab. ${templateOption === 'Existing' ? 'Clicking Save saves your changes to the selected template.' : ''}`,
    },
    {
      label: `Enter custom ${option.label.toLowerCase()}`,
      ariaLabel: `Enter custom ${option.label.toLowerCase()}`,
      value: 'Custom',
      description: `Enter custom ${option.label.toLowerCase()}. ${templateOption === 'Custom' ? 'Clicking Save will save the custom value only.' : ''}`,
    },
  ];

  useEffect(() => {
    if (template?.value?.name) {
      setCustomTemplateValue(getUseTemplateText(template.value.name));
    }
  }, [template]);

  function onCustomTemplateChange(customInput: string) {
    setCustomTemplateValue(customInput);
  }

  const onTemplateOptionChange = (option: TemplateFieldOption) => {
    setTemplateOption(option);
  };

  const options = useMemo(() => {
    if (!defaultTemplates || !data || isLoading || error) {
      return [];
    }
    return getTemplateOptions(data, defaultTemplates);
  }, [data, defaultTemplates, isLoading, error]);

  const defaultTemplateValue = useMemo(() => {
    if (!options.length || !Boolean(valueInForm) || !matchesOnlyOneTemplate(valueInForm)) {
      return null;
    }
    const nameOfTemplateInForm = getTemplateName(valueInForm);

    return options.find((option) => option.label === nameOfTemplateInForm) || null;
  }, [options, valueInForm]);

  if (error) {
    return (
      <div>
        <Trans i18nKey="alerting.template-selector.error-loading-templates">Error loading templates</Trans>
      </div>
    );
  }

  if (isLoading || !data || !defaultTemplates) {
    return (
      <div>
        <Trans i18nKey="alerting.template-selector.loading">Loading...</Trans>
      </div>
    );
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
                data-testid="existing-templates-selector"
                placeholder={t(
                  'alerting.template-selector.existing-templates-selector-placeholder-choose-notification-template',
                  'Choose notification template'
                )}
                aria-label={t(
                  'alerting.template-selector.existing-templates-selector-aria-label-choose-notification-template',
                  'Choose notification template'
                )}
                onChange={(value: SelectableValue<Template>, _) => {
                  setTemplate(value);
                }}
                options={options}
                width={50}
                defaultValue={defaultTemplateValue}
              />
              <IconButton
                tooltip="Copy selected notification template to clipboard. You can use it in the custom tab."
                onClick={() =>
                  copyToClipboard(getUseTemplateText(template?.value?.name ?? defaultTemplateValue?.value?.name ?? ''))
                }
                name="copy"
              />
            </Stack>

            <TemplateContentAndPreview
              templateContent={template?.value?.content ?? defaultTemplateValue?.value?.content ?? ''}
              payload={defaultPayloadString}
              templateName={template?.value?.name ?? defaultTemplateValue?.value?.name ?? ''}
              setPayloadFormatError={() => {}}
              className={cx(styles.templatePreview, styles.minEditorSize)}
              payloadFormatError={null}
            />
          </Stack>
        ) : (
          <OptionCustomfield
            option={option}
            onCustomTemplateChange={onCustomTemplateChange}
            initialValue={customTemplateValue}
          />
        )}
      </Stack>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onClose}>
          <Trans i18nKey="alerting.common.cancel">Cancel</Trans>
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            if (templateOption === 'Custom') {
              trackUseCustomInputInTemplate();
              onSelect(customTemplateValue);
            } else {
              trackUseSingleTemplateInInput();
              const name = template?.value?.name ?? defaultTemplateValue?.value?.name ?? '';
              onSelect(getUseTemplateText(name));
            }
            return onClose();
          }}
        >
          <Trans i18nKey="common.save">Save</Trans>
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
  const id = `custom-template-${option.label}`;
  return (
    <Stack direction="column" gap={1}>
      <Label htmlFor={id}>
        <Trans i18nKey="alerting.contact-points.custom-template-value">Custom template value</Trans>
      </Label>
      <TextArea
        id={id}
        label={t('alerting.option-customfield.label-custom-template', 'Custom template')}
        placeholder={option.placeholder}
        onChange={(e) => onCustomTemplateChange(e.currentTarget.value)}
        defaultValue={initialValue}
      />
    </Stack>
  );
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
