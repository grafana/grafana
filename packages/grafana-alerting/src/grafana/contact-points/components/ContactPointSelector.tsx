import { alertingAPI } from '@grafana/alerting';
import { config } from '@grafana/runtime';
import { Combobox, ComboboxOption } from '@grafana/ui';

import { getContactPointDescription } from '../utils';

type ContactPointSelectorProps = {
  onChange: (option: ComboboxOption<string>) => void;
};

function ContactPointSelector({ onChange }: ContactPointSelectorProps) {
  const { currentData: contactPoints, isLoading } = alertingAPI.endpoints.listReceiver.useQuery({
    namespace: config.namespace,
  });

  const options: ComboboxOption[] = (contactPoints?.items ?? []).map((contactPoint) => ({
    label: contactPoint.spec.title,
    value: contactPoint.metadata.uid ?? contactPoint.spec.title,
    // @todo make ComboBox accept a ReactNode so we can use icons and such
    description: getContactPointDescription(contactPoint),
  }));

  return <Combobox loading={isLoading} onChange={onChange} options={options} />;
}

export { ContactPointSelector };
