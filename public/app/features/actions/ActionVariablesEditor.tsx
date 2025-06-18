import { useState } from 'react';

import { ActionVariable, ActionVariableType } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, Input, Stack, Combobox, ComboboxOption } from '@grafana/ui';

interface Props {
  onChange: (v: ActionVariable[]) => void;
  value: ActionVariable[];
}

export const ActionVariablesEditor = ({ value, onChange }: Props) => {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<ActionVariableType>(ActionVariableType.String);

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
    newVariables.sort((a, b) => a.key.localeCompare(b.key));
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
    <div>
      <Stack direction="row">
        <Input
          value={key}
          onChange={(e) => changeKey(e.currentTarget.value)}
          placeholder={t('actions.params-editor.placeholder-key', 'Key')}
          width={300}
        />
        <Input
          value={name}
          onChange={(e) => changeName(e.currentTarget.value)}
          placeholder={t('actions.params-editor.placeholder-name', 'Name')}
          width={300}
        />
        <Combobox
          value={type}
          onChange={changeType}
          placeholder={t('actions.variables-editor.placeholder-type', 'Type')}
          options={variableTypeOptions}
          maxWidth={100}
          minWidth={10}
          width={'auto'}
        />
        <IconButton
          aria-label={t('actions.params-editor.aria-label-add', 'Add')}
          name="plus-circle"
          onClick={() => addVariable()}
          disabled={isAddButtonDisabled}
        />
      </Stack>

      <Stack direction="column">
        {value.map((entry) => (
          <Stack key={entry.key} direction="row">
            <Input disabled value={entry.key} width={300} />
            <Input disabled value={entry.name} width={300} />
            <Input disabled value={entry.type} width={100} />
            <IconButton
              aria-label={t('actions.params-editor.aria-label-delete', 'Delete')}
              onClick={removeVariable(entry.key)}
              name="trash-alt"
            />
          </Stack>
        ))}
      </Stack>
    </div>
  );
};
