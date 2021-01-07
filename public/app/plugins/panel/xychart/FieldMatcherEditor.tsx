import React, { FC, useCallback } from 'react';
import { Select } from '@grafana/ui';
import { DataFrame, MatcherConfig, SelectableValue } from '@grafana/data';

import { fieldDimensionMatchersUI } from '@grafana/ui/src/components/MatchersUI/fieldMatchersUI';

export interface Props {
  data?: DataFrame[];
  value: MatcherConfig;
  onChange: (value?: MatcherConfig) => void;
}

export const FieldMatcherEditor: FC<Props> = ({ data, value, onChange }) => {
  const matcherUi = fieldDimensionMatchersUI.get(value.id);
  const matcherInfo = fieldDimensionMatchersUI.selectOptions([value.id]);

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
      <Select options={matcherInfo.options} value={matcherInfo.current} onChange={onMatcherTypeChange} />

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
