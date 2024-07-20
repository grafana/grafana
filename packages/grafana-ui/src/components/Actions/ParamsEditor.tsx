import { useState } from 'react';
import * as React from 'react';

import { VariableSuggestion } from '@grafana/data';

import { IconButton } from '../IconButton/IconButton';
import { Input } from '../Input/Input';
import { Stack } from '../Layout/Stack/Stack';

interface Props {
  onChange: (v: Array<[string, string]>) => void;
  value: Array<[string, string]>;
  suggestions: VariableSuggestion[];
}

export const ParamsEditor = ({ value, onChange, suggestions }: Props) => {
  const [paramName, setParamName] = useState('');
  const [paramValue, setParamValue] = useState('');

  const changeParamValue = ({ currentTarget }: React.ChangeEvent<HTMLInputElement>) => {
    setParamValue(currentTarget.value);
  };

  const changeParamName = ({ currentTarget }: React.ChangeEvent<HTMLInputElement>) => {
    setParamName(currentTarget.value);
  };

  const removeParam = (key: string) => () => {
    const updatedParams = value.filter((param) => param[0] !== key);
    onChange(updatedParams);
  };

  const addParam = () => {
    const key = paramName;
    let newParams: Array<[string, string]>;
    if (value) {
      newParams = value.filter((e) => e[0] !== key);
    } else {
      newParams = [];
    }
    newParams.push([key, paramValue]);
    newParams.sort((a, b) => a[0].localeCompare(b[0]));

    setParamName('');
    setParamValue('');
    onChange(newParams);
  };

  const isAddParamsDisabled = !paramName && !paramValue;

  // @TODO: Suggestions
  return (
    <div>
      <Stack direction="row">
        {/*<SuggestionsInput*/}
        {/*  value={paramName}*/}
        {/*  onChange={() => changeParamName}*/}
        {/*  suggestions={suggestions}*/}
        {/*  placeholder="Key"*/}
        {/*/>*/}
        {/*<SuggestionsInput*/}
        {/*  value={paramValue}*/}
        {/*  onChange={() => changeParamValue}*/}
        {/*  suggestions={suggestions}*/}
        {/*  placeholder="Value"*/}
        {/*/>*/}
        <Input value={paramName} onChange={changeParamName} placeholder="Key" />
        <Input value={paramValue} onChange={changeParamValue} placeholder="Value" />
        <IconButton aria-label="add" name="plus-circle" onClick={addParam} disabled={isAddParamsDisabled} />
      </Stack>
      <Stack direction="column">
        {Array.from(value || []).map((entry) => (
          <Stack key={entry[0]} direction="row">
            <Input disabled value={entry[0]} />
            <Input disabled value={entry[1]} />
            <IconButton aria-label="delete" onClick={removeParam(entry[0])} name="trash-alt" />
          </Stack>
        ))}
      </Stack>
    </div>
  );
};
