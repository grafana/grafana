import { ComponentProps } from 'react';
import Skeleton from 'react-loading-skeleton';

import { base64UrlEncode } from '@grafana/alerting';
import { notificationsAPIv0alpha1 } from '@grafana/alerting/unstable';
import { TextLink } from '@grafana/ui';

import { stringifyFieldSelector } from '../../utils/k8s/utils';
import { makeEditContactPointLink } from '../../utils/misc';

interface ContactPointLinkProps extends Omit<ComponentProps<typeof TextLink>, 'href' | 'children'> {
  name: string;
}

export const ContactPointLink = ({ name, ...props }: ContactPointLinkProps) => {
  const encodedName = base64UrlEncode(name);

  // find receiver by name using metadata.name field selector
  const { currentData, isLoading, isSuccess } = notificationsAPIv0alpha1.endpoints.listReceiver.useQuery({
    fieldSelector: stringifyFieldSelector([['metadata.name', encodedName]]),
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
