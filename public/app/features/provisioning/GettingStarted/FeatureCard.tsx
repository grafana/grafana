import { css } from '@emotion/css';

import { Box, Stack, Text } from '@grafana/ui';

interface FeatureCardProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  showBorder?: boolean;
}

export const FeatureCard = ({ title, description, icon, action, showBorder = false }: FeatureCardProps) => (
  <Box width="25%" padding={2}>
    <div
      className={css({
        borderRight: showBorder ? ': 1px solid rgba(204, 204, 220, 0.15);' : undefined,
        height: `100%`,
      })}
    >
      <Stack direction="column" gap={2}>
        {icon}
        <Text variant="h3">{title}</Text>
        <Text variant="body">{description}</Text>
        {action && <Box>{action}</Box>}
      </Stack>
    </div>
  </Box>
);
