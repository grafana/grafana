import { FormEvent, useMemo, useState } from 'react';
import { lastValueFrom } from 'rxjs';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { CustomVariable, SceneVariable, VariableValueOption } from '@grafana/scenes';
import { Box, Button, Modal, RadioButtonGroup, Stack, TextArea } from '@grafana/ui';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { CustomVariableForm } from '../components/CustomVariableForm';
import { VariableStaticOptionsForm } from '../components/VariableStaticOptionsForm';
import { VariableValuesPreview } from '../components/VariableValuesPreview';
import { hasVariableOptions } from '../utils';

interface CustomVariableEditorProps {
  variable: CustomVariable;
  onRunQuery: () => void;
}

export function CustomVariableEditor({ variable, onRunQuery }: CustomVariableEditorProps) {
  const { query, isMulti, allValue, includeAll, allowCustomValue } = variable.useState();

  const onMultiChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ isMulti: event.currentTarget.checked });
  };
  const onIncludeAllChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ includeAll: event.currentTarget.checked });
  };
  const onQueryChange = (event: FormEvent<HTMLTextAreaElement>) => {
    variable.setState({ query: event.currentTarget.value });
    onRunQuery();
  };
  const onAllValueChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ allValue: event.currentTarget.value });
  };
  const onAllowCustomValueChange = (event: FormEvent<HTMLInputElement>) => {
    variable.setState({ allowCustomValue: event.currentTarget.checked });
  };

  return (
    <CustomVariableForm
      query={query ?? ''}
      multi={!!isMulti}
      allValue={allValue ?? ''}
      includeAll={!!includeAll}
      allowCustomValue={allowCustomValue}
      onMultiChange={onMultiChange}
      onIncludeAllChange={onIncludeAllChange}
      onQueryChange={onQueryChange}
      onAllValueChange={onAllValueChange}
      onAllowCustomValueChange={onAllowCustomValueChange}
    />
  );
}

export function getCustomVariableOptions(variable: SceneVariable): OptionsPaneItemDescriptor[] {
  if (!(variable instanceof CustomVariable)) {
    return [];
  }

  return [
    new OptionsPaneItemDescriptor({
      title: t('dashboard.edit-pane.variable.custom-options.values', 'Values separated by comma'),
      id: 'custom-variable-values',
      render: ({ props }) => <ModalEditor id={props.id} variable={variable} />,
    }),
  ];
}

export function ModalEditor({ variable, id }: { variable: CustomVariable; id?: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Box display="flex" direction="column" paddingBottom={1}>
        <Button
          tooltip={t(
            'dashboard.edit-pane.variable.open-editor-tooltip',
            'For more variable options open variable editor'
          )}
          onClick={() => setIsOpen(true)}
          size="sm"
          fullWidth
          data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.optionsOpenButton}
        >
          <Trans i18nKey="dashboard.edit-pane.variable.open-editor">Open variable editor</Trans>
        </Button>
      </Box>
      <Modal
        title={t('dashboard.edit-pane.variable.custom-options.modal-title', 'Custom Variable')}
        isOpen={isOpen}
        onDismiss={() => setIsOpen(false)}
      >
        <Editor variable={variable} id={id} />
        <Modal.ButtonRow>
          <Button
            variant="secondary"
            fill="outline"
            onClick={() => setIsOpen(false)}
            data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.closeButton}
          >
            <Trans i18nKey="dashboard.edit-pane.variable.custom-options.close">Close</Trans>
          </Button>
        </Modal.ButtonRow>
      </Modal>
    </>
  );
}

function Editor({ variable, id }: { variable: CustomVariable; id?: string }) {
  // Workaround to toggle a component refresh when values change so that the preview is updated
  variable.useState();

  const [editorType, setEditorType] = useState<'builder' | 'static'>('builder');

  const editorTypeOptions: Array<SelectableValue<'builder' | 'static'>> = useMemo(
    () => [
      { label: t('dashboard.edit-pane.variable.custom-options.editor-type.builder', 'Builder'), value: 'builder' },
      { label: t('dashboard.edit-pane.variable.custom-options.editor-type.static', 'Static'), value: 'static' },
    ],
    []
  );

  const isHasVariableOptions = hasVariableOptions(variable);

  return (
    <Stack direction="column" gap={2}>
      <RadioButtonGroup
        value={editorType}
        options={editorTypeOptions}
        fullWidth
        onChange={(value) => setEditorType(value)}
      />
      {editorType === 'builder' ? (
        <ValuesBuilder variable={variable} />
      ) : (
        <ValuesTextField variable={variable} id={id} />
      )}
      {isHasVariableOptions && <VariableValuesPreview options={variable.getOptionsForSelect(false)} />}
    </Stack>
  );
}

function ValuesBuilder({ variable }: { variable: CustomVariable }) {
  const { query } = variable.useState();
  const match = useMemo(() => query.match(/(?:\\,|[^,])+/g) ?? [], [query]);
  const options = useMemo<VariableValueOption[]>(
    () =>
      match.map((text) => {
        text = text.replace(/\\,/g, ',');
        const textMatch = /^\s*(.+)\s:\s(.+)$/g.exec(text) ?? [];

        if (textMatch.length === 3) {
          const [, label, value] = textMatch;
          return { label: label.trim(), value: value.trim() };
        }

        text = text.trim();
        return { label: '', value: text };
      }),
    [match]
  );

  const handleOptionsChange = async (options: VariableValueOption[]) => {
    variable.setState({
      query: options
        .map((option) => {
          if (!option.label || option.label === option.value) {
            return String(option.value).replaceAll(',', '\\,');
          }

          return `${option.label.replaceAll(',', '\\,')} : ${String(option.value).replaceAll(',', '\\,')}`;
        })
        .join(', '),
    });
    await lastValueFrom(variable.validateAndUpdate!());
  };

  return <VariableStaticOptionsForm options={options} onChange={handleOptionsChange} />;
}

function ValuesTextField({ variable, id }: { variable: CustomVariable; id?: string }) {
  const { query } = variable.useState();

  const onBlur = async (event: FormEvent<HTMLTextAreaElement>) => {
    variable.setState({ query: event.currentTarget.value });
    await lastValueFrom(variable.validateAndUpdate!());
  };

  return (
    <TextArea
      id={id}
      rows={2}
      defaultValue={query}
      onBlur={onBlur}
      placeholder={t(
        'dashboard.edit-pane.variable.custom-options.values-placeholder',
        '1, 10, mykey : myvalue, myvalue, escaped\,value'
      )}
      required
      data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput}
    />
  );
}
