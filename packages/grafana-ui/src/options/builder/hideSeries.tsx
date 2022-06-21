import { startCase } from 'lodash';
import React, { useCallback } from 'react';

import { FieldConfigEditorBuilder, FieldConfigEditorProps } from '@grafana/data';
import { HideableFieldConfig, HideSeriesConfig } from '@grafana/schema';

import { FilterPill, HorizontalGroup } from '../../index';

const SeriesConfigEditor: React.FC<FieldConfigEditorProps<HideSeriesConfig, {}>> = (props) => {
  const { value, onChange } = props;

  const onChangeToggle = useCallback(
    (prop: keyof HideSeriesConfig) => {
      onChange({ ...value, [prop]: !value[prop] });
    },
    [value, onChange]
  );

  return (
    <HorizontalGroup spacing="xs">
      {Object.keys(value).map((k) => {
        const key = k as keyof HideSeriesConfig;
        return (
          <FilterPill
            icon={value[key] ? 'eye-slash' : 'eye'}
            onClick={() => onChangeToggle(key)}
            key={key}
            label={startCase(key)}
            selected={value[key]}
          />
        );
      })}
    </HorizontalGroup>
  );
};

/**
 * @alpha
 */
export function addHideFrom(builder: FieldConfigEditorBuilder<HideableFieldConfig>) {
  builder.addCustomEditor({
    id: 'hideFrom',
    name: 'Hide in area',
    category: ['Series'],
    path: 'hideFrom',
    defaultValue: {
      tooltip: false,
      viz: false,
      legend: false,
    },
    editor: SeriesConfigEditor,
    override: SeriesConfigEditor,
    shouldApply: () => true,
    hideFromDefaults: true,
    process: (value) => value,
  });
}
