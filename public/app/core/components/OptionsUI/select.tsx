import { useAsync } from 'react-use';

import { type StandardEditorProps, type SelectFieldConfigSettings, type SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

type Props<T> = StandardEditorProps<T, SelectFieldConfigSettings<T>>;

export function SelectValueEditor<T>({ value, onChange, item, id, context }: Props<T>) {
  const { settings } = item;

  const { value: options } = useAsync(async (): Promise<Array<SelectableValue<T>>> => {
    if (settings?.getOptions) {
      return settings.getOptions(context);
    }
    return settings?.options ?? [];
  }, [settings, context]);

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
