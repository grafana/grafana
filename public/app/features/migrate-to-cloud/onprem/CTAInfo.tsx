import { ReactNode } from 'react';

import { Stack, Box, Text } from '@grafana/ui';

interface CTAInfoProps {
  title: NonNullable<ReactNode>;
  accessory?: ReactNode;
  children: ReactNode;
}

export function CTAInfo(props: CTAInfoProps) {
  const { title, accessory, children } = props;

  return (
    <Box maxWidth={44} display="flex" direction="row" gap={1} alignItems="flex-start">
      {accessory && <Box>{accessory}</Box>}

      <Stack gap={2} direction="column" alignItems="flex-start">
        <Text element="h3" variant="h5">
          {title}
        </Text>

        {children}
      </Stack>
    </Box>
  );
}
