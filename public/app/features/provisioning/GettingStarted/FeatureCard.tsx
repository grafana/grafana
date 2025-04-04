import { ReactNode } from 'react';

import { Box, Stack, Text } from '@grafana/ui';

interface FeatureCardProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export const FeatureCard = ({ title, description, icon, action }: FeatureCardProps) => (
  <Box width="40%" height="100%" padding={2} display="flex" direction="column" gap={2} alignItems="flex-start">
    {icon}
    <Text>{title}</Text>
    <Stack flex={1}>
      <Text variant="body" color="secondary">
        {description}
      </Text>
    </Stack>
    {action && <Box>{action}</Box>}
  </Box>
);
