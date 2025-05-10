import { chain } from 'lodash';

import { Combobox, ComboboxOption } from '@grafana/ui';

import { ContactPoint } from '../../api/v0alpha1/types';
import { useListContactPointsv0alpha1 } from '../hooks/useContactPoints';
import { getContactPointDescription } from '../utils';

const collator = new Intl.Collator('en', { sensitivity: 'accent' });

interface BaseContactPointSelectorProps {
  id?: string;
  placeholder?: string;
  width?: number | 'auto';
  value?: string;
}

type ClearableProps = {
  isClearable: true;
  onChange: (contactPoint: ContactPoint | null) => void;
};

type NonClearableProps = {
  isClearable?: false;
  onChange: (contactPoint: ContactPoint) => void;
};

type ContactPointSelectorProps = BaseContactPointSelectorProps & (ClearableProps | NonClearableProps);

/**
 * Contact Point Combobox which lists all available contact points
 * @TODO make ComboBox accept a ReactNode so we can use icons and such
 */
function ContactPointSelector({
  onChange,
  id,
  width = 'auto',
  isClearable = false,
  value,
  placeholder,
}: ContactPointSelectorProps) {
  const { currentData: contactPoints, isLoading } = useListContactPointsv0alpha1();

  // Create a mapping of options with their corresponding contact points
  const contactPointOptions = chain(contactPoints?.items)
    .toArray()
    .map((contactPoint) => ({
      option: {
        label: contactPoint.spec.title,
        value: contactPoint.metadata.uid ?? contactPoint.spec.title,
        description: getContactPointDescription(contactPoint),
      } satisfies ComboboxOption<string>,
      contactPoint,
    }))
    .value()
    .sort((a, b) => collator.compare(a.option.label, b.option.label));

  const options = contactPointOptions.map<ComboboxOption>((item) => item.option);

  const handleChange = (selectedOption: ComboboxOption<string> | null) => {
    if (!selectedOption) {
      onChange(null as any); // sadly yes, we need this type-cast for TypeScript to not complain here
      return;
    }

    const selectedItem = contactPointOptions.find(({ option }) => option.value === selectedOption.value);
    if (!selectedItem) {
      return;
    }

    onChange(selectedItem.contactPoint);
  };

  return (
    <Combobox
      placeholder={placeholder}
      loading={isLoading}
      onChange={handleChange}
      options={options}
      isClearable={isClearable}
      id={id}
      width={width === 'auto' ? undefined : width}
      value={value}
    />
  );
}

export { ContactPointSelector };
