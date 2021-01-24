import React, { memo, useMemo, useCallback } from 'react';
import { MatcherUIProps, FieldMatcherUIRegistryItem } from './types';
import {
  FieldMatcherID,
  fieldMatchers,
  getFieldDisplayName,
  SelectableValue,
  DataFrame,
  ByNamesMatcherOptions,
} from '@grafana/data';
import { MultiSelect } from '../Select/Select';
import { Input } from '../Input/Input';

export const FieldNamesMatcherEditor = memo<MatcherUIProps<ByNamesMatcherOptions>>((props) => {
  const { data, options, onChange: onChangeFromProps } = props;
  const { readOnly, prefix } = options;
  const names = useFieldDisplayNames(data);
  const selectOptions = useSelectOptions(names);

  if (readOnly) {
    const displayNames = (options.names ?? []).join(', ');
    return <Input value={displayNames} readOnly={true} disabled={true} prefix={prefix} />;
  }

  const onChange = useCallback(
    (selections: Array<SelectableValue<string>>) => {
      if (!Array.isArray(selections)) {
        return;
      }

      return onChangeFromProps({
        ...options,
        names: selections.reduce((all: string[], current) => {
          if (!current?.value || !names.has(current.value)) {
            return all;
          }
          all.push(current.value);
          return all;
        }, []),
      });
    },
    [names, onChangeFromProps]
  );

  return <MultiSelect value={options.names} options={selectOptions} onChange={onChange} />;
});
FieldNamesMatcherEditor.displayName = 'FieldNameMatcherEditor';

export const fieldNamesMatcherItem: FieldMatcherUIRegistryItem<ByNamesMatcherOptions> = {
  id: FieldMatcherID.byNames,
  component: FieldNamesMatcherEditor,
  matcher: fieldMatchers.get(FieldMatcherID.byNames),
  name: 'Fields with name',
  description: 'Set properties for a specific field',
  optionsToLabel: (options) => (options.names ?? []).join(', '),
  excludeFromPicker: true,
};

const useFieldDisplayNames = (data: DataFrame[]): Set<string> => {
  return useMemo(() => {
    const names: Set<string> = new Set();

    for (const frame of data) {
      for (const field of frame.fields) {
        names.add(getFieldDisplayName(field, frame, data));
      }
    }

    return names;
  }, [data]);
};

const useSelectOptions = (displayNames: Set<string>): Array<SelectableValue<string>> => {
  return useMemo(() => {
    return Array.from(displayNames).map((n) => ({
      value: n,
      label: n,
    }));
  }, [displayNames]);
};
