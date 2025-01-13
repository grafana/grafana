import { Box, Card, FilterInput, Stack, Text } from '@grafana/ui';
import { AddonBarPane } from 'app/core/components/AppChrome/AddonBar/AddonBarPane';

export function DashboardContentPane() {
  return (
    <AddonBarPane title="Content outline">
      <Box paddingX={2} grow={1}>
        <Stack direction={'column'} grow={1} gap={1} height={'100%'}>
          <FilterInput placeholder="Search" onChange={() => {}} value={''} />
          <Text variant="bodySmall" italic>
            Sections
          </Text>
          <Stack direction={'column'} gap={0.5}>
            <Card href="link" isCompact>
              <Card.Heading>Interpolation modes</Card.Heading>
            </Card>
            <Card href="link" isCompact>
              <Card.Heading>Soft min & max</Card.Heading>
            </Card>
            <Card href="link" isCompact>
              <Card.Heading>Multiple Y-Axes</Card.Heading>
            </Card>
            <Card href="link" isCompact>
              <Card.Heading>Time series panel & display options</Card.Heading>
            </Card>
          </Stack>
        </Stack>
      </Box>
    </AddonBarPane>
  );
}
