import { chain } from 'lodash';

import { Combobox, ComboboxOption } from '@grafana/ui';

// TODO: Make the types external
import { Resource } from '../../../../../../public/app/features/apiserver/types';
import { ContactPointAdapter } from '../types';

const collator = new Intl.Collator('en', { sensitivity: 'accent' });

export type ContactPointSelectorProps<ActualApiContactPointType> = {
  adapter: ContactPointAdapter<ActualApiContactPointType>;
  onChange: (contactPointResource: Resource<ActualApiContactPointType> | null) => void;
};
/**
 * Contact Point Combobox which lists all available contact points
 * @TODO make ComboBox accept a ReactNode so we can use icons and such
 */
function ContactPointSelector<ActualApiContactPointType>({
  onChange,
  adapter,
}: ContactPointSelectorProps<ActualApiContactPointType>) {
  const { currentData: contactPoints, isLoading } = adapter.useListContactPoints();

  const contactPointOptions = chain(contactPoints?.items ?? [])
    .toArray()
    .map((contactPoint) => {
      const genericCp = adapter.toGenericContactPoint(contactPoint);
      return {
        option: {
          label: genericCp.title,
          value: genericCp.uid,
          description: genericCp.description,
        } satisfies ComboboxOption,
        originalContactPoint: contactPoint,
      };
    })
    .value()
    .sort((a, b) => collator.compare(a.option.label, b.option.label));

  const options = contactPointOptions.map<ComboboxOption>((item) => item.option);

  const handleChange = ({ value }: ComboboxOption<string>) => {
    const selectedItem = contactPointOptions.find(({ option }) => option.value === value);
    if (!selectedItem) {
      return;
    }

    onChange(selectedItem.originalContactPoint);
  };

  return <Combobox loading={isLoading} onChange={handleChange} options={options} />;
}

export { ContactPointSelector };
