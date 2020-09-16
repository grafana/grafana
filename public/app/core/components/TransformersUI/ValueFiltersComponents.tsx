import React from 'react';
import { Input } from '@grafana/ui';

import { ValueFilterID } from '@grafana/data/src/transformations/valueFilters';

interface Props {
  filterArgs: Record<string, any>;
  invalidArgs: Record<string, boolean>;
  onArgsChange: (filterArgs: Record<string, any>) => void;
}

function SingleTextInput(placeholder: string, argName: string) {
  const component: React.FC<Props> = ({ filterArgs, invalidArgs, onArgsChange }) => {
    return (
      <div className="gf-form gf-form--grow gf-form-spacing ">
        <Input
          className="flex-grow-1"
          invalid={invalidArgs[argName] ?? false}
          defaultValue={filterArgs?.regex}
          placeholder={placeholder}
          onBlur={event => {
            onArgsChange({ [argName]: event.currentTarget.value });
          }}
        />
      </div>
    );
  };

  return component;
}

const RangeInput: React.FC<Props> = ({ filterArgs, invalidArgs, onArgsChange }) => {
  return (
    <>
      <div className="gf-form gf-form-spacing gf-form--grow">
        <Input
          className="flex-grow-1"
          invalid={invalidArgs.max ?? false}
          defaultValue={filterArgs?.min}
          placeholder="Min"
          onBlur={event => {
            onArgsChange({ min: event.currentTarget.value, max: filterArgs.max });
          }}
        />
      </div>
      <div className="gf-form gf-form-spacing gf-form--grow">
        <Input
          className="flex-grow-1"
          invalid={invalidArgs.min ?? false}
          defaultValue={filterArgs?.max}
          placeholder="Max"
          onBlur={event => {
            onArgsChange({ min: filterArgs.min, max: event.currentTarget.value });
          }}
        />
      </div>
    </>
  );
};

const components: Record<ValueFilterID, React.FC<Props> | null> = {
  [ValueFilterID.regex]: SingleTextInput('Regex', 'regex'),
  [ValueFilterID.isNull]: null,
  [ValueFilterID.isNotNull]: null,
  [ValueFilterID.greater]: SingleTextInput('Value', 'value'),
  [ValueFilterID.greaterOrEqual]: SingleTextInput('Value', 'value'),
  [ValueFilterID.lower]: SingleTextInput('Value', 'value'),
  [ValueFilterID.lowerOrEqual]: SingleTextInput('Value', 'value'),
  [ValueFilterID.equal]: SingleTextInput('Value', 'value'),
  [ValueFilterID.notEqual]: SingleTextInput('Value', 'value'),
  [ValueFilterID.range]: RangeInput,
};

export function getValueFilterArgsComponent(filterType: ValueFilterID) {
  return components[filterType];
}
