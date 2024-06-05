import { startCase } from 'lodash';
import { useCallback } from 'react';

import { FieldConfigEditorBuilder, StandardEditorProps } from '@grafana/data';
import { HideableFieldConfig, HideSeriesConfig } from '@grafana/schema';

import { FilterPill } from '../../components/FilterPill/FilterPill';
import { Stack } from '../../components/Layout/Stack/Stack';

const SeriesConfigEditor = ({ value, onChange }: StandardEditorProps<HideSeriesConfig, {}>) => {
  const onChangeToggle = useCallback(
    (prop: keyof HideSeriesConfig) => {
      onChange({ ...value, [prop]: !value[prop] });
    },
    [value, onChange]
  );

  return (
    <Stack gap={0.5}>
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
    </Stack>
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
