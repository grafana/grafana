import { type ComponentProps } from 'react';
import Skeleton from 'react-loading-skeleton';

import { notificationsAPIv1beta1 } from '@grafana/alerting/unstable';
import { TextLink } from '@grafana/ui';

import { stringifyFieldSelector } from '../../utils/k8s/utils';
import { makeEditContactPointLink } from '../../utils/misc';

interface ContactPointLinkProps extends Omit<ComponentProps<typeof TextLink>, 'href' | 'children'> {
  name: string;
}

export const ContactPointLink = ({ name, ...props }: ContactPointLinkProps) => {
  // find receiver by title using spec.title field selector
  const { currentData, isLoading, isSuccess } = notificationsAPIv1beta1.endpoints.listReceiver.useQuery({
    fieldSelector: stringifyFieldSelector([['spec.title', name]]),
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
