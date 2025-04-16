import { chain } from 'lodash';

import { Combobox, ComboboxOption } from '@grafana/ui';

import { useGetContactPoints } from '../hooks/useContactPoints';
import { getContactPointDescription } from '../utils';

const collator = new Intl.Collator('en', { sensitivity: 'accent' });

type ContactPointSelectorProps = {
  onChange: (option: ComboboxOption<string>) => void;
};

/**
 * Contact Point Combobox which lists all available contact points
 * @TODO make ComboBox accept a ReactNode so we can use icons and such
 */
function ContactPointSelector({ onChange }: ContactPointSelectorProps) {
  const { currentData: contactPoints, isLoading } = useGetContactPoints();

  // create the options for the combobox, make sure we sort them by label
  const options: ComboboxOption[] = chain(contactPoints?.items)
    .toArray()
    .map((contactPoint) => ({
      label: contactPoint.spec.title,
      value: contactPoint.metadata.uid ?? contactPoint.spec.title,
      description: getContactPointDescription(contactPoint),
    }))
    .value()
    .sort((a, b) => collator.compare(a.label, b.label));

  return <Combobox loading={isLoading} onChange={onChange} options={options} />;
}

export { ContactPointSelector };
