import { chain } from 'lodash';

import { Combobox, ComboboxOption } from '@grafana/ui';

import { useListContactPoints } from '../hooks/useContactPoints';
import { ContactPoint } from '../types';
import { getContactPointDescription } from '../utils';

const collator = new Intl.Collator('en', { sensitivity: 'accent' });

type ContactPointSelectorProps = {
  onChange: (contactPoint: ContactPoint) => void;
};

/**
 * Contact Point Combobox which lists all available contact points
 * @TODO make ComboBox accept a ReactNode so we can use icons and such
 */
function ContactPointSelector({ onChange }: ContactPointSelectorProps) {
  const { currentData: contactPoints, isLoading } = useListContactPoints();

  // Create a mapping of options with their corresponding contact points
  const contactPointOptions = chain(contactPoints?.items)
    .toArray()
    .map((contactPoint) => ({
      option: {
        label: contactPoint.spec.title,
        value: contactPoint.metadata.uid ?? contactPoint.spec.title,
        description: getContactPointDescription(contactPoint),
      },
      contactPoint,
    }))
    .value()
    .sort((a, b) => collator.compare(a.option.label, b.option.label));

  const options = contactPointOptions.map<ComboboxOption>((item) => item.option);

  const handleChange = ({ value }: ComboboxOption<string>) => {
    const selectedItem = contactPointOptions.find(({ option }) => option.value === value);
    if (!selectedItem) {
      return;
    }

    onChange(selectedItem.contactPoint);
  };

  return <Combobox loading={isLoading} onChange={handleChange} options={options} />;
}

export { ContactPointSelector };
