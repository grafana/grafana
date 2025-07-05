import React, { useMemo } from 'react';

import { StandardEditorProps, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { MultiSelect } from '@grafana/ui';

interface StateSelectorSettings {
  // Future: could add options here for filtering which states to show
}

interface StateSelectorProps extends StandardEditorProps<string[], StateSelectorSettings> {
  // Additional props if needed
}

export const StateSelector: React.FC<StateSelectorProps> = ({ value = [], onChange, context }) => {
  // Extract available states from the current data
  const availableStates = useMemo(() => {
    if (!context.data) {
      return [];
    }

    const stateSet = new Set<string>();

    // Iterate through all frames and non-time fields to collect unique values
    context.data.forEach((frame) => {
      frame.fields.forEach((field) => {
        if (field.type !== 'time') {
          field.values.forEach((val) => {
            if (val != null && val !== '') {
              // Convert to string to handle different value types
              stateSet.add(String(val));
            }
          });
        }
      });
    });

    // Convert to SelectableValue array and sort
    return Array.from(stateSet)
      .sort()
      .map(
        (state): SelectableValue<string> => ({
          label: state,
          value: state,
        })
      );
  }, [context.data]);

  const selectedStates = useMemo(() => {
    return value.map(
      (state): SelectableValue<string> => ({
        label: state,
        value: state,
      })
    );
  }, [value]);

  const handleChange = (selections: Array<SelectableValue<string>>) => {
    const newStates = selections.map((selection) => selection.value!).filter(Boolean);
    onChange(newStates);
  };

  return (
    <MultiSelect
      options={availableStates}
      value={selectedStates}
      onChange={handleChange}
      placeholder={t('state-timeline.state-selector.placeholder', 'Select states')}
      isClearable
      closeMenuOnSelect={false}
      maxVisibleValues={5}
    />
  );
};
