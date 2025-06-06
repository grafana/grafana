import Skeleton from 'react-loading-skeleton';

import { alertingAPIv0alpha1 } from '@grafana/alerting/unstable';
import { TextLink } from '@grafana/ui';

import { makeEditContactPointLink } from '../../utils/misc';

interface ContactPointLinkProps {
  name: string;
}

export const ContactPointLink = ({ name }: ContactPointLinkProps) => {
  // find receiver by name – since this is what we store in the alert rule definition
  const { currentData, isLoading, isSuccess } = alertingAPIv0alpha1.endpoints.listReceiver.useQuery({
    fieldSelector: `spec.title=${name}`,
  });

  // grab the first result from the fieldSelector result
  const receiverUID = currentData?.items.at(0)?.metadata.name;

  if (isLoading) {
    return loader;
  }

  if (isSuccess && receiverUID) {
    return (
      <TextLink
        variant="bodySmall"
        href={makeEditContactPointLink(receiverUID, { alertmanager: 'grafana' })}
        inline={false}
      >
        {name}
      </TextLink>
    );
  }

  return name;
};

const loader = <Skeleton height={8} width={64} />;
