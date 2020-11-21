import React, { FC, useCallback } from 'react';
import { ValuePicker } from '@grafana/ui';
import { DataFrame, MatcherConfig, SelectableValue } from '@grafana/data';

import { fieldDimensionMatchersUI } from '@grafana/ui/src/components/MatchersUI/fieldMatchersUI';

export interface Props {
  data?: DataFrame[];
  value: MatcherConfig;
  onChange: (value?: MatcherConfig) => void;
}

export const FieldMatcherEditor: FC<Props> = ({ data, value, onChange }) => {
  const matcherUi = fieldDimensionMatchersUI.get(value.id);
  const matcherOptions = fieldDimensionMatchersUI.selectOptions().options;

  const onMatcherConfigChange = useCallback(
    (options: any) => {
      onChange({
        ...value,
        options,
      });
    },
    [value, onChange]
  );

  const onMatcherTypeChange = useCallback(
    (sel: SelectableValue<string>) => {
      const registryItem = fieldDimensionMatchersUI.get(sel.value!);
      if (!registryItem) {
        return;
      }
      const cfg: MatcherConfig = {
        id: registryItem.id,
      };
      if (registryItem.matcher.defaultOptions) {
        cfg.options = { ...registryItem.matcher.defaultOptions };
      }
      onChange(cfg);
    },
    [value, onChange]
  );

  return (
    <div>
      <ValuePicker
        label={matcherUi.name || 'Field Matcher'}
        variant="secondary"
        icon="plus"
        options={matcherOptions}
        onChange={onMatcherTypeChange}
        isFullWidth={true}
      />

      {matcherUi && (
        <matcherUi.component
          matcher={matcherUi.matcher}
          data={data ?? []}
          options={value.options}
          onChange={option => onMatcherConfigChange(option)}
        />
      )}
    </div>
  );
};
