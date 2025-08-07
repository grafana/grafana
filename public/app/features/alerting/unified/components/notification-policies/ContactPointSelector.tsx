import { useEffect, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Select, SelectCommonProps, Text } from '@grafana/ui';
import { ContactPointReceiverSummary } from 'app/features/alerting/unified/components/contact-points/ContactPoint';
import { useAlertmanager } from 'app/features/alerting/unified/state/AlertmanagerContext';

import { useContactPointsWithStatus } from '../contact-points/useContactPoints';
import { ContactPointWithMetadata } from '../contact-points/utils';

const MAX_CONTACT_POINTS_RENDERED = 500;

type ContactPointSelectorProps = {
  selectProps: SelectCommonProps<ContactPointWithMetadata>;
  /** Name of a contact point to optionally find and set as the preset value on the dropdown */
  selectedContactPointName?: string | null;
  onError?: (error: Error) => void;
};

export const ExternalAlertmanagerContactPointSelector = ({
  selectProps,
  selectedContactPointName,
  onError = () => {},
}: ContactPointSelectorProps) => {
  const { selectedAlertmanager } = useAlertmanager();
  const { contactPoints, isLoading, error } = useContactPointsWithStatus({
    alertmanager: selectedAlertmanager!,
  });

  const options: Array<SelectableValue<ContactPointWithMetadata>> = contactPoints.map((contactPoint) => {
    return {
      label: contactPoint.name,
      value: contactPoint,
      component: () => (
        <Text variant="bodySmall" color="secondary">
          <ContactPointReceiverSummary receivers={contactPoint.grafana_managed_receiver_configs} limit={2} />
        </Text>
      ),
    };
  });

  const matchedContactPoint: SelectableValue<ContactPointWithMetadata> | null = useMemo(() => {
    return options.find((option) => option.value?.name === selectedContactPointName) || null;
  }, [options, selectedContactPointName]);

  useEffect(() => {
    // If the contact points are fetched successfully and the selected contact point is not in the list, show an error
    if (!isLoading && selectedContactPointName && !matchedContactPoint) {
      onError(new Error(`Contact point "${selectedContactPointName}" could not be found`));
    }
  }, [isLoading, matchedContactPoint, onError, selectedContactPointName]);

  // TODO error handling
  if (error) {
    return (
      <Alert
        title={t(
          'alerting.contact-point-selector.title-failed-to-fetch-contact-points',
          'Failed to fetch contact points'
        )}
        severity="error"
      />
    );
  }

  return (
    <Select
      virtualized={options.length > MAX_CONTACT_POINTS_RENDERED}
      options={options}
      value={matchedContactPoint}
      {...selectProps}
      isLoading={isLoading}
      disabled={isLoading}
    />
  );
};
