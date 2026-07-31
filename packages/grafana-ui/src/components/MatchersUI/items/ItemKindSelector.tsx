import { useMemo } from 'react';

import { type ItemKindDescriptor, type SelectableValue } from '@grafana/data';

import { RadioButtonGroup, type RadioButtonGroupProps } from '../../Forms/RadioButtonGroup/RadioButtonGroup';

export interface ItemKindSelectorProps extends Omit<RadioButtonGroupProps<string>, 'options'> {
  kinds: ItemKindDescriptor[];
}

export function buildKindOptions(kinds: ItemKindDescriptor[], currentKind?: string): Array<SelectableValue<string>> {
  const options: Array<SelectableValue<string>> = kinds.map((kind) => ({
    label: kind.name,
    value: kind.id,
  }));

  // A rule saved against a kind this plugin no longer declares stays selectable, so switching
  // panel types back and forth does not quietly rewrite the rule to a different kind.
  if (currentKind && !kinds.some((kind) => kind.id === currentKind)) {
    options.push({ label: currentKind, value: currentKind });
  }

  return options;
}

/**
 * Picks which mark universe an item override rule targets. A direct analogue of
 * {@link MatcherScopeSelector}, but the kinds are declared by the panel plugin rather than
 * drawn from a closed enum.
 *
 * @alpha
 */
export function ItemKindSelector({ value, kinds, ...rest }: ItemKindSelectorProps) {
  const options = useMemo(() => buildKindOptions(kinds, value), [kinds, value]);
  return <RadioButtonGroup {...rest} options={options} value={value ?? options[0]?.value} />;
}
