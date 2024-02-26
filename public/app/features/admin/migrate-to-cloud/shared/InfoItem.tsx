import React, { ReactNode } from 'react';

import { Stack, Text, TextLink } from '@grafana/ui';

interface Props {
  children: NonNullable<ReactNode>;
  title: string;
  linkTitle?: string;
  linkHref?: string;
}

export const InfoItem = ({ children, title, linkHref, linkTitle }: Props) => {
  return (
    <Stack gap={2} direction="column">
      <Text element="h4">{title}</Text>
      <Text color="secondary">{children}</Text>
      {linkHref && (
        <TextLink href={linkHref} external>
          {linkTitle ?? linkHref}
        </TextLink>
      )}
    </Stack>
  );
};
