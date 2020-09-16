import React from 'react';
import { Input } from '@grafana/ui';

import { ValueFilterID } from '@grafana/data/src/transformations/valueFilters';

interface Props {
  filterArgs: Record<string, any>;
  invalidArgs: string[];
  onArgsChange: (filterArgs: Record<string, any>) => void;
}

const RegexComponent: React.FC<Props> = ({ filterArgs, invalidArgs, onArgsChange }) => {
  return (
    <div className="gf-form gf-form--grow gf-form-spacing ">
      <Input
        className="flex-grow-1"
        invalid={invalidArgs.includes('regex')}
        defaultValue={filterArgs?.regex}
        placeholder="Regex"
        onBlur={event => {
          onArgsChange({ regex: event.currentTarget.value });
        }}
      />
    </div>
  );
};

const components: Record<ValueFilterID, React.FC<Props> | null> = {
  [ValueFilterID.regex]: RegexComponent,
  [ValueFilterID.isNull]: null,
  [ValueFilterID.isNotNull]: null,
  [ValueFilterID.greater]: null,
  [ValueFilterID.greaterOrEqual]: null,
  [ValueFilterID.lower]: null,
  [ValueFilterID.lowerOrEqual]: null,
  [ValueFilterID.equal]: null,
  [ValueFilterID.notEqual]: null,
  [ValueFilterID.range]: null,
};

export function getValueFilterArgsComponent(filterType: ValueFilterID) {
  return components[filterType];
}
