import { chain } from 'lodash';

import { Combobox, ComboboxOption } from '@grafana/ui';

import type { ContactPoint } from '../../../api/notifications/v0alpha1/types';
import { useListContactPoints } from '../../hooks/v0alpha1/useContactPoints';
import { getContactPointDescription } from '../../utils';

import { CustomComboBoxProps } from './ComboBox.types';

const collator = new Intl.Collator('en', { sensitivity: 'accent' });

// Annotation key that indicates whether a contact point can be used in routes and rules
const CAN_USE_ANNOTATION = 'grafana.com/canUse';

export type ContactPointSelectorProps = CustomComboBoxProps<ContactPoint> & {
  /**
   * Whether to include contact points that are not usable (e.g., imported from external sources).
   * Unusable contact points have the `grafana.com/canUse` annotation set to `false`.
   * @default false
   */
  includeUnusable?: boolean;
};

/**
 * Contact Point Combobox which lists all available contact points.
 * By default, only shows contact points that can be used (have `grafana.com/canUse: true`).
 * Set `includeUnusable` to `true` to show all contact points including imported ones.
 */
function ContactPointSelector(props: ContactPointSelectorProps) {
  const { includeUnusable = false, ...comboboxProps } = props;

  const { currentData: contactPoints, isLoading } = useListContactPoints(
    {},
    { refetchOnFocus: true, refetchOnMountOrArgChange: true }
  );

  // Create a mapping of options with their corresponding contact points
  const contactPointOptions = chain(contactPoints?.items)
    .toArray()
    .filter((contactPoint) => {
      if (includeUnusable) {
        return true;
      }
      // By default, only include contact points that can be used
      const canUse = contactPoint.metadata?.annotations?.[CAN_USE_ANNOTATION];
      return canUse === 'true';
    })
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
    if (selectedOption == null && comboboxProps.isClearable) {
      comboboxProps.onChange(null);
      return;
    }

    if (selectedOption) {
      const matchedOption = contactPointOptions.find(({ option }) => option.value === selectedOption.value);
      if (!matchedOption) {
        return;
      }

      comboboxProps.onChange(matchedOption.contactPoint);
    }
  };

  return <Combobox {...comboboxProps} loading={isLoading} options={options} onChange={handleChange} />;
}

export { ContactPointSelector };
