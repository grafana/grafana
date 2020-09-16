import React from 'react';
import { Input } from '@grafana/ui';

import { ValueFilterID } from '@grafana/data/src/transformations/valueFilters';

function RegexComponent({ filterArgs, invalidArgs, onArgsChange }) {
  console.log('filterArgs', filterArgs, invalidArgs);

  return (
    <div className="gf-form gf-form--grow gf-form-spacing ">
      <Input
        className="flex-grow-1"
        invalid={invalidArgs?.regex}
        defaultValue={filterArgs?.regex}
        placeholder="Regex"
        onBlur={event => {
          onArgsChange({ regex: event.currentTarget.value });
        }}
      />
    </div>
  );
}

const components: Record<ValueFilterID, React.Component> = {
  [ValueFilterID.regex]: RegexComponent,
};

export function getValueFilterArgsComponent(filterType: ValueFilterID) {
  return components[filterType];
}
