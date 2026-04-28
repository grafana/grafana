import { Stack } from '@grafana/ui';
import { useDeleteContactPointModal } from 'app/features/alerting/unified/components/contact-points/components/Modals';
import { useDeleteContactPoint } from 'app/features/alerting/unified/components/contact-points/useContactPoints';
import { type ContactPointWithMetadata } from 'app/features/alerting/unified/components/contact-points/utils';
import { useAlertmanager } from 'app/features/alerting/unified/state/AlertmanagerContext';

import { ContactPointInstanceDrawerIntegrations } from './ContactPointInstanceDrawerIntegrations';
import { ContactPointInstanceDrawerToolbar } from './ContactPointInstanceDrawerToolbar';
import { ContactPointInstanceDrawerUsage } from './ContactPointInstanceDrawerUsage';

function getReceiverResourceId(contactPoint: ContactPointWithMetadata): string {
  return contactPoint.id ?? contactPoint.name;
}

export interface ContactPointInstanceDrawerDetailsProps {
  contactPoint: ContactPointWithMetadata;
}

/**
 * Contact point body for the alert instance drawer — avoids the notifications page card chrome and duplicate title.
 */
export function ContactPointInstanceDrawerDetails({ contactPoint }: ContactPointInstanceDrawerDetailsProps) {
  const { selectedAlertmanager } = useAlertmanager();
  const [deleteTrigger] = useDeleteContactPoint({ alertmanager: selectedAlertmanager! });
  const [DeleteModal, showDeleteModal] = useDeleteContactPointModal(deleteTrigger.execute);

  return (
    <Stack direction="column" gap={3} data-testid="contact-point-instance-drawer">
      <ContactPointInstanceDrawerToolbar
        contactPoint={contactPoint}
        onDelete={(cp) =>
          showDeleteModal({
            name: getReceiverResourceId(cp),
            resourceVersion: cp.metadata?.resourceVersion,
          })
        }
      />
      <ContactPointInstanceDrawerUsage contactPoint={contactPoint} />
      <ContactPointInstanceDrawerIntegrations contactPoint={contactPoint} />
      {DeleteModal}
    </Stack>
  );
}
