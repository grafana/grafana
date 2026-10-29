import { useEffect, useState } from 'react';

import { type StandardEditorProps, type SelectFieldConfigSettings, type SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

type Props<T> = StandardEditorProps<T, SelectFieldConfigSettings<T>>;

export function SelectValueEditor<T>({ value, onChange, item, id, context }: Props<T>) {
  const { settings } = item;

  const [dynamicOptions, setDynamicOptions] = useState<Array<SelectableValue<T>>>();

  useEffect(() => {
    // bail early for static options
    if (!settings?.getOptions) {
      return;
    }

    let cancelled = false;
    settings.getOptions(context).then((next) => {
      if (!cancelled) {
        setDynamicOptions(next);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [settings, context]);

  const options = settings?.getOptions ? dynamicOptions : (settings?.options ?? []);

  let current = options?.find((v) => v.value === value);
  if (!current && value) {
    current = {
      label: `${value}`,
      value,
    };
  }

  return (
    <Select<T>
      inputId={id}
      // Loading state is "options have never arrived", not "a fetch is in flight" — options
      // are kept across refetches, so a reload must not put the picker back into loading.
      isLoading={options === undefined}
      value={current}
      defaultValue={value}
      allowCustomValue={settings?.allowCustomValue}
      isClearable={settings?.isClearable}
      onChange={(e) => onChange(e?.value)}
      options={options ?? []}
    />
  );
}
