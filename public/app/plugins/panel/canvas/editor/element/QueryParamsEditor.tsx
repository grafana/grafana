import React, { useState } from 'react';

import { HorizontalGroup, IconButton, Input, VerticalGroup } from '@grafana/ui';

interface Props {
  onChange: (v: Array<[string, string]>) => void;
  value: Array<[string, string]>;
}

export const QueryParamsEditor = ({ value, onChange }: Props) => {
  const [paramName, setParamName] = useState('');
  const [paramValue, setParamValue] = useState('');

  const changeParamValue = ({ target }: any) => {
    setParamValue(target.value);
  };

  const changeParamName = ({ target }: any) => {
    setParamName(target.value);
  };

  const removeParam =
    (key: string) =>
    ({ target }: any) => {
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

  return (
    <div>
      <HorizontalGroup>
        <Input placeholder="Key" value={paramName} onChange={changeParamName} />
        <Input placeholder="Value" value={paramValue} onChange={changeParamValue} />
        <IconButton aria-label="add" name="plus-circle" onClick={addParam} />
      </HorizontalGroup>
      <VerticalGroup>
        {Array.from(value || []).map((entry) => (
          <HorizontalGroup key={entry[0]}>
            <Input disabled value={entry[0]} />
            <Input disabled value={entry[1]} />
            <IconButton aria-label="delete" onClick={removeParam(entry[0])} name="trash-alt" />
          </HorizontalGroup>
        ))}
      </VerticalGroup>
    </div>
  );
};
