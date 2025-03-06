import { Box, Stack, Text } from '@grafana/ui';
import { css } from '@emotion/css';

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
      className={css`
        ${showBorder ? 'border-right: 1px solid rgba(204, 204, 220, 0.15);' : ''}
        height: 100%;
      `}
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
