import { chain } from 'lodash';

import { t } from '@grafana/i18n';
import { Combobox, type ComboboxOption } from '@grafana/ui';

import type { ContactPoint } from '../../../api/notifications/v1beta1/types';
import { type CustomComboBoxProps } from '../../../common/ComboBox.types';
import { useListContactPoints } from '../../hooks/v1beta1/useContactPoints';
import { getContactPointDescription, isUsableContactPoint } from '../../utils';

const collator = new Intl.Collator('en', { sensitivity: 'accent' });

export type ContactPointSelectorProps = CustomComboBoxProps<ContactPoint>;

/**
 * Contact Point Combobox which lists all available contact points.
 * Imported contact points (with `grafana.com/canUse: false`) are shown as disabled.
 */
function ContactPointSelector(props: ContactPointSelectorProps) {
  const { currentData: contactPoints, isLoading } = useListContactPoints(
    {},
    { refetchOnFocus: true, refetchOnMountOrArgChange: true }
  );

  // Create a mapping of options with their corresponding contact points
  const contactPointOptions = chain(contactPoints?.items)
    .toArray()
    .map((contactPoint) => {
      const usable = isUsableContactPoint(contactPoint);
      return {
        option: {
          label: contactPoint.spec.title,
          value: contactPoint.metadata.uid ?? contactPoint.spec.title,
          description: usable
            ? getContactPointDescription(contactPoint)
            : t(
                'alerting.contact-point-selector.imported-description',
                'Imported contact points cannot be used in routes'
              ),
          group: usable ? undefined : t('alerting.contact-point-selector.imported-group', 'Imported'),
          infoOption: !usable,
        } satisfies ComboboxOption<string>,
        contactPoint,
      };
    })
    .value()
    .sort((a, b) => {
      // Usable contact points first, then imported ones
      if (a.option.infoOption !== b.option.infoOption) {
        return a.option.infoOption ? 1 : -1;
      }
      return collator.compare(a.option.label ?? '', b.option.label ?? '');
    });

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
