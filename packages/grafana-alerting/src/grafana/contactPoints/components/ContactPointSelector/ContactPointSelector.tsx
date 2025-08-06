import { chain } from 'lodash';
import { useMemo } from 'react';

import { Combobox, ComboboxOption } from '@grafana/ui';

import type { ContactPoint } from '../../../api/v0alpha1/types';
import { useListContactPoints } from '../../hooks/v0alpha1/useContactPoints';
import { getContactPointDescription } from '../../utils';

import { CustomComboBoxProps } from './ComboBox.types';

const collator = new Intl.Collator('en', { sensitivity: 'accent' });

export type ContactPointSelectorProps = Omit<CustomComboBoxProps<ContactPoint>, 'value'> & {
  value?: ContactPoint | string | null;
};

/**
 * Contact Point Combobox which lists all available contact points
 * @TODO make ComboBox accept a ReactNode so we can use icons and such
 */
function ContactPointSelector(props: ContactPointSelectorProps) {
  const { value: valueProp, onChange, ...restProps } = props;
  const { currentData: contactPoints, isLoading } = useListContactPoints();

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

  // Convert value (ContactPoint object OR string) to the string value expected by Combobox
  const comboboxValue = useMemo(() => {
    if (!valueProp) {
      return undefined;
    }

    // Handle ContactPoint object
    if (typeof valueProp === 'object' && valueProp.spec?.title) {
      const matchingOption = contactPointOptions.find(
        ({ contactPoint }) => contactPoint.spec.title === valueProp.spec.title
      );
      return matchingOption?.option.value;
    }

    // Handle string value (backward compatibility)
    if (typeof valueProp === 'string') {
      const matchingOption = contactPointOptions.find(({ contactPoint }) => contactPoint.spec.title === valueProp);
      return matchingOption?.option.value;
    }

    return undefined;
  }, [valueProp, contactPointOptions]);

  const handleChange = (selectedOption: ComboboxOption<string> | null) => {
    if (selectedOption == null && props.isClearable) {
      (onChange as (value: ContactPoint | null) => void)(null);
      return;
    }

    if (selectedOption) {
      const matchedOption = contactPointOptions.find(({ option }) => option.value === selectedOption.value);
      if (!matchedOption) {
        return;
      }

      onChange(matchedOption.contactPoint);
    }
  };

  return (
    <Combobox
      {...(restProps as any)}
      value={comboboxValue}
      loading={isLoading}
      options={options}
      onChange={handleChange}
    />
  );
}

export { ContactPointSelector };
