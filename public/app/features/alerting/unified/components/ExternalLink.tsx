import React, { HTMLAttributes } from 'react';

import { Stack } from '@grafana/experimental';
import { Icon, Text } from '@grafana/ui';

interface Props extends HTMLAttributes<HTMLAnchorElement> {
  href?: string;
  external?: boolean;
  size?: 'md' | 'sm';
}

const Link = ({ children, href, size = 'md', external = false, ...rest }: Props) => {
  const externalProps = external ? { target: '_blank', rel: 'noreferrer' } : {};
  const small = (size = 'sm');

  return (
    <a href={href} {...externalProps} {...rest}>
      <Text color="link" variant={small ? 'bodySmall' : 'body'}>
        <Stack direction="row" alignItems="center" gap={0.5}>
          {children} {external && <Icon size={small ? 'xs' : 'sm'} name="external-link-alt" />}
        </Stack>
      </Text>
    </a>
  );
};

export { Link };
