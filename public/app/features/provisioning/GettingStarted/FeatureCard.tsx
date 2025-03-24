import { Box, Stack, Text } from '@grafana/ui';

interface FeatureCardProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const FeatureCard = ({ title, description, icon, action }: FeatureCardProps) => (
  <Box width="25%" padding={2}>
    <div style={{ height: '100%' }}>
      <Stack direction="column" gap={2}>
        {icon}
        <Text variant="h3">{title}</Text>
        <Text variant="body">{description}</Text>
        {action && <Box>{action}</Box>}
      </Stack>
    </div>
  </Box>
);
