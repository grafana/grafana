import { useAsync } from 'react-use';

import { type StandardEditorProps, type SelectFieldConfigSettings, type SelectableValue } from '@grafana/data';
import { MultiSelect } from '@grafana/ui';

type Props<T> = StandardEditorProps<T[], SelectFieldConfigSettings<T>>;

/**
 * MultiSelect for options UI
 */
export function MultiSelectValueEditor<T>({ value, onChange, item, id, context }: Props<T>) {
  const { settings } = item;

  const { value: options } = useAsync(async (): Promise<Array<SelectableValue<T>>> => {
    if (settings?.getOptions) {
      return settings.getOptions(context);
    }
    return settings?.options ?? [];
  }, [settings, context]);

  return (
    <MultiSelect<T>
      inputId={id}
      // Loading state is "options have never arrived", not "a fetch is in flight" — options
      // are kept across refetches, so a reload must not put the picker back into loading.
      isLoading={options === undefined}
      value={value}
      defaultValue={value}
      allowCustomValue={settings?.allowCustomValue}
      onChange={(e) => {
        onChange(e.map((v) => v.value).flatMap((v) => (v !== undefined ? [v] : [])));
      }}
      options={options ?? []}
    />
  );
}
