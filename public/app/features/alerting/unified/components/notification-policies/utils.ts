import { ControllerRenderProps } from 'react-hook-form';

import { SelectableValue } from '@grafana/data';
import { ContactPointWithMetadata } from 'app/features/alerting/unified/components/contact-points/utils';

export const handleContactPointSelect = (
  value: SelectableValue<ContactPointWithMetadata>,
  onChange: ControllerRenderProps['onChange']
) => {
  if (value === null) {
    return onChange(null);
  }

  if (!value) {
    return onChange('');
  }

  return onChange(value.value?.name);
};
