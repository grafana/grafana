import { Box, Card, FilterInput, Stack, Text } from '@grafana/ui';
import { AddonBarPane } from 'app/core/components/AppChrome/AddonBar/AddonBarPane';

export function DashboardContentPane() {
  return (
    <AddonBarPane title="Filters">
      <Box paddingX={2} grow={1}>
        <Stack direction={'column'} grow={1} gap={1} height={'100%'}>
          <Text variant="bodySmall" italic>
            Sections
          </Text>
          <Stack direction={'column'} gap={0.5}>
            <Card href="link" isCompact>
              <Card.Heading>job = server</Card.Heading>
            </Card>
            <Card href="link" isCompact>
              <Card.Heading>cluster = US</Card.Heading>
            </Card>
          </Stack>
        </Stack>
      </Box>
    </AddonBarPane>
  );
}
