import { useId, useState } from 'react';

import { type ActionVariable, ActionVariableType } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, Input, Label, Stack, Combobox, type ComboboxOption } from '@grafana/ui';

interface Props {
  onChange: (v: ActionVariable[]) => void;
  value: ActionVariable[];
}

const collator = new Intl.Collator();

export const ActionVariablesEditor = ({ value, onChange }: Props) => {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<ActionVariableType>(ActionVariableType.String);
  const keyId = useId();
  const nameId = useId();
  const typeId = useId();
  const keyLabelId = useId();
  const nameLabelId = useId();
  const typeLabelId = useId();

  const changeKey = (key: string) => {
    setKey(key);
  };

  const changeName = (name: string) => {
    setName(name);
  };

  const changeType = (type: ComboboxOption) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    setType(type.value as ActionVariableType);
  };

  const addVariable = () => {
    let newVariables: ActionVariable[];

    if (value) {
      newVariables = value.filter((e) => e.key !== key);
    } else {
      newVariables = [];
    }

    newVariables.push({ key, name, type });
    newVariables.sort((a, b) => collator.compare(a.key, b.key));
    onChange(newVariables);

    setKey('');
    setName('');
    setType(ActionVariableType.String);
  };

  const removeVariable = (key: string) => () => {
    const updatedVariables = value.filter((variable) => variable.key !== key);
    onChange(updatedVariables);
  };

  const isAddButtonDisabled = name === '' || key === '';

  const variableTypeOptions: ComboboxOption[] = [
    {
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      label: 'string',
      value: ActionVariableType.String,
    },
  ];

  return (
    <Stack direction="column" gap={1}>
      <Stack direction="row" alignItems="flex-end">
        <div>
          <Label id={keyLabelId} htmlFor={keyId}>
            {t('actions.variables-editor.label-key', 'Key')}
          </Label>
          <Input
            id={keyId}
            value={key}
            onChange={(e) => changeKey(e.currentTarget.value)}
            placeholder={t('actions.params-editor.placeholder-key', 'Key')}
            width={300}
          />
        </div>
        <div>
          <Label id={nameLabelId} htmlFor={nameId}>
            {t('actions.variables-editor.label-name', 'Name')}
          </Label>
          <Input
            id={nameId}
            value={name}
            onChange={(e) => changeName(e.currentTarget.value)}
            placeholder={t('actions.params-editor.placeholder-name', 'Name')}
            width={300}
          />
        </div>
        <div>
          <Label id={typeLabelId} htmlFor={typeId}>
            {t('actions.variables-editor.label-type', 'Type')}
          </Label>
          <Combobox
            id={typeId}
            value={type}
            onChange={changeType}
            placeholder={t('actions.variables-editor.placeholder-type', 'Type')}
            options={variableTypeOptions}
            maxWidth={100}
            minWidth={10}
            width={'auto'}
          />
        </div>
        <IconButton
          aria-label={t('actions.params-editor.aria-label-add', 'Add')}
          name="plus-circle"
          onClick={() => addVariable()}
          disabled={isAddButtonDisabled}
        />
      </Stack>

      <Stack direction="column" gap={1}>
        {value.map((entry) => (
          <Stack key={entry.key} direction="row">
            <Input disabled value={entry.key} width={300} aria-labelledby={keyLabelId} />
            <Input disabled value={entry.name} width={300} aria-labelledby={nameLabelId} />
            <Input disabled value={entry.type} width={100} aria-labelledby={typeLabelId} />
            <IconButton
              aria-label={t('actions.params-editor.aria-label-delete', 'Delete')}
              onClick={removeVariable(entry.key)}
              name="trash-alt"
            />
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
};
