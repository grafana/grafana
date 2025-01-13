import { ComboboxOption } from './Combobox';

export function itemToString<T extends string | number>(item?: ComboboxOption<T> | null) {
  if (!item) {
    return '';
  }
  if (item.label?.includes('Custom value: ')) {
    return item.value.toString();
  }
  return item.label ?? item.value.toString();
}

export function itemFilter<T extends string | number>(inputValue: string) {
  const lowerCasedInputValue = inputValue.toLowerCase();

  return (item: ComboboxOption<T>) => {
    return (
      !inputValue ||
      item.label?.toLowerCase().includes(lowerCasedInputValue) ||
      item.value?.toString().toLowerCase().includes(lowerCasedInputValue)
    );
  };
}
