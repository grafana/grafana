import { ComponentProps } from 'react';
import Skeleton from 'react-loading-skeleton';

import { notificationsAPI } from '@grafana/alerting/unstable';
import { TextLink } from '@grafana/ui';

import { makeEditContactPointLink } from '../../utils/misc';

interface ContactPointLinkProps extends Omit<ComponentProps<typeof TextLink>, 'href' | 'children'> {
  name: string;
}

export const ContactPointLink = ({ name, ...props }: ContactPointLinkProps) => {
  // find receiver by name – since this is what we store in the alert rule definition
  const { currentData, isLoading, isSuccess } = notificationsAPI.endpoints.listReceiver.useQuery({
    fieldSelector: `spec.title=${name}`,
  });

  // grab the first result from the fieldSelector result
  const receiverUID = currentData?.items.at(0)?.metadata.name;

  if (isLoading) {
    return loader;
  }

  if (isSuccess && receiverUID) {
    return (
      <TextLink href={makeEditContactPointLink(receiverUID, { alertmanager: 'grafana' })} inline={false} {...props}>
        {name}
      </TextLink>
    );
  }

  return name;
};

const loader = <Skeleton height={8} width={64} />;
