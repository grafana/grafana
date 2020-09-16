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
          defaultValue={filterArgs?.[argName] ?? null}
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
  [ValueFilterID.regex]: SingleTextInput('Regex', 'expression'),
  [ValueFilterID.isNull]: null,
  [ValueFilterID.isNotNull]: null,
  [ValueFilterID.greater]: SingleTextInput('Value', 'expression'),
  [ValueFilterID.greaterOrEqual]: SingleTextInput('Value', 'expression'),
  [ValueFilterID.lower]: SingleTextInput('Value', 'expression'),
  [ValueFilterID.lowerOrEqual]: SingleTextInput('Value', 'expression'),
  [ValueFilterID.equal]: SingleTextInput('Value', 'expression'),
  [ValueFilterID.notEqual]: SingleTextInput('Value', 'expression'),
  [ValueFilterID.range]: RangeInput,
};

export function getValueFilterArgsComponent(filterType: ValueFilterID) {
  return components[filterType];
}
