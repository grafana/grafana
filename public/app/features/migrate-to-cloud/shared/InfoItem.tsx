import { type ReactNode } from 'react';

import { Card, Text, TextLink } from '@grafana/ui';

interface Props {
  children: NonNullable<ReactNode>;
  title: string;
  linkTitle?: string;
  linkHref?: string;
}

export const InfoItem = ({ children, title, linkHref, linkTitle }: Props) => {
  return (
    <Card noMargin>
      <Card.Heading>
        <Text element="h2" variant="h4">
          {title}
        </Text>
      </Card.Heading>
      <Card.Description>
        <Text color="secondary">{children}</Text>
      </Card.Description>
      {linkHref && (
        <Card.Actions>
          <TextLink href={linkHref} external>
            {linkTitle ?? linkHref}
          </TextLink>
        </Card.Actions>
      )}
    </Card>
  );
};
