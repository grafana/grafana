import React, { memo, useMemo, useCallback } from 'react';
import { MatcherUIProps, FieldMatcherUIRegistryItem } from './types';
import {
  FieldMatcherID,
  fieldMatchers,
  SelectableValue,
  DataFrame,
  FrameFieldsDisplayNames,
  getFrameFieldsDisplayNames,
} from '@grafana/data';
import { Select } from '../Select/Select';

export const FieldNameMatcherEditor = memo<MatcherUIProps<string>>((props) => {
  const { data, options, onChange: onChangeFromProps } = props;
  const names = useFrameFieldsDisplayNames(data);
  const selectOptions = useSelectOptions(names, options);

  const onChange = useCallback(
    (selection: SelectableValue<string>) => {
      const { value } = selection;
      if (!value) {
        return;
      }
      if (names.display.has(value) || names.raw.has(value)) {
        return;
      }
      return onChangeFromProps(value);
    },
    [names, onChangeFromProps]
  );

  const selectedOption = selectOptions.find((v) => v.value === options);
  return <Select value={selectedOption} options={selectOptions} onChange={onChange} />;
});
FieldNameMatcherEditor.displayName = 'FieldNameMatcherEditor';

export const fieldNameMatcherItem: FieldMatcherUIRegistryItem<string> = {
  id: FieldMatcherID.byName,
  component: FieldNameMatcherEditor,
  matcher: fieldMatchers.get(FieldMatcherID.byName),
  name: 'Fields with name',
  description: 'Set properties for a specific field',
  optionsToLabel: (options) => options,
};

export function useFrameFieldsDisplayNames(data: DataFrame[]): FrameFieldsDisplayNames {
  return useMemo(() => {
    return getFrameFieldsDisplayNames(data);
  }, [data]);
}

const useSelectOptions = (
  displayNames: FrameFieldsDisplayNames,
  currentName: string
): Array<SelectableValue<string>> => {
  return useMemo(() => {
    let found = false;
    const options: Array<SelectableValue<string>> = [];
    for (const name of displayNames.display) {
      if (!found && name === currentName) {
        found = true;
      }
      options.push({
        value: name,
        label: name,
      });
    }
    for (const name of displayNames.raw) {
      if (!displayNames.display.has(name)) {
        if (!found && name === currentName) {
          found = true;
        }
        options.push({
          value: name,
          label: `${name} (raw)`,
        });
      }
    }

    if (currentName && !found) {
      options.push({
        value: currentName,
        label: `${currentName} (not found)`,
      });
    }
    return options;
  }, [displayNames, currentName]);
};
