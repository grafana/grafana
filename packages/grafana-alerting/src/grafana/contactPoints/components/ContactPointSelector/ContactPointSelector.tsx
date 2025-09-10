import { chain } from 'lodash';

import { Combobox, ComboboxOption } from '@grafana/ui';

import { alertingAPI } from '../../../api/v0alpha1/api.gen';
import type { ContactPoint } from '../../../api/v0alpha1/types';
import { getContactPointDescription } from '../../utils';

import { CustomComboBoxProps } from './ComboBox.types';

const collator = new Intl.Collator('en', { sensitivity: 'accent' });

export type ContactPointSelectorProps = CustomComboBoxProps<ContactPoint>;

/**
 * Contact Point Combobox which lists all available contact points
 * @TODO make ComboBox accept a ReactNode so we can use icons and such
 */
function ContactPointSelector(props: ContactPointSelectorProps) {
  const { currentData: contactPoints, isLoading } = alertingAPI.useListReceiverQuery(
    {},
    { refetchOnFocus: true, refetchOnMountOrArgChange: true }
  );

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
    if (selectedOption == null && props.isClearable) {
      props.onChange(null);
      return;
    }

    if (selectedOption) {
      const matchedOption = contactPointOptions.find(({ option }) => option.value === selectedOption.value);
      if (!matchedOption) {
        return;
      }

      props.onChange(matchedOption.contactPoint);
    }
  };

  return <Combobox {...props} loading={isLoading} options={options} onChange={handleChange} />;
}

export { ContactPointSelector };
