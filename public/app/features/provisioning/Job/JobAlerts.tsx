import { JobStatus } from 'app/api/clients/provisioning/v0alpha1';

import { ProvisioningAlert } from '../Shared/ProvisioningAlert';

import { getJobMessages } from './getJobMessage';

export function JobAlerts({ status }: { status: JobStatus }) {
  const { state } = status;
  const messages = getJobMessages(status);

  if (state === 'success') {
    return <ProvisioningAlert success={{ message: status.message }} />;
  }

  if (state === 'error' || state === 'warning') {
    return (
      <>
        {messages.error && <ProvisioningAlert error={{ message: messages.error }} />}
        {messages.warning && <ProvisioningAlert warning={{ message: messages.warning }} />}
      </>
    );
  }

  return null;
}
