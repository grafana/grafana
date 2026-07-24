import { type ReactNode } from 'react';

import { Box, Divider, Text } from '@grafana/ui';

interface MethodPanelCardProps {
  title: string;
  /** Optional content rendered on the right of the header (e.g. a status badge). */
  headerActions?: ReactNode;
  children: ReactNode;
}

/** Card surface for an import-method panel: titled header + body, matching the import wizard design. */
export function MethodPanelCard({ title, headerActions, children }: MethodPanelCardProps) {
  return (
    <Box
      backgroundColor="secondary"
      borderColor="weak"
      borderStyle="solid"
      borderRadius="default"
      display="flex"
      direction="column"
    >
      <Box display="flex" justifyContent="space-between" alignItems="center" gap={1} paddingX={2} paddingY={1.5}>
        <Text element="h3" variant="h4">
          {title}
        </Text>
        {headerActions}
      </Box>
      <Divider spacing={0} />
      <Box display="flex" direction="column" gap={2} padding={2}>
        {children}
      </Box>
    </Box>
  );
}
