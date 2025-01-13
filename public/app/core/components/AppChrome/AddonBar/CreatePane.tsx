import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Box, Card, Stack, useStyles2, Text } from '@grafana/ui';

import { AddonBarPane } from './AddonBarPane';

export function CreatePane() {
  const styles = useStyles2(getStyles);
  //   const navIndex = useSelector((s) => s.navIndex);
  //   const helpNode = cloneDeep(navIndex['help']);
  //   const enrichedHelpNode = helpNode ? enrichHelpItem(helpNode) : undefined;

  return (
    <AddonBarPane title="Create / add">
      <Box paddingX={2} grow={1}>
        <Stack direction={'column'} grow={1} gap={1} height={'100%'}>
          <Text variant="bodySmall" italic>
            Based on context
          </Text>
          <Stack direction={'column'} gap={0.5}>
            <Card href="link" isCompact>
              <Card.Heading>+ Panel</Card.Heading>
            </Card>
            <Card href="link" isCompact>
              <Card.Heading>+ Row</Card.Heading>
            </Card>
            <Card href="link" isCompact>
              <Card.Heading>+ Variable</Card.Heading>
            </Card>
          </Stack>
          <div className={styles.divider} />
          <Text variant="bodySmall" italic>
            New entites
          </Text>
          <Stack direction={'column'} gap={0.5}>
            <Card href="link" isCompact>
              <Card.Heading>New dashboard</Card.Heading>
            </Card>
            <Card href="link" isCompact>
              <Card.Heading>Import dashboard</Card.Heading>
            </Card>
            <Card href="link" isCompact>
              <Card.Heading>New alert rule</Card.Heading>
            </Card>
            <Card href="link" isCompact>
              <Card.Heading>New incident</Card.Heading>
            </Card>
          </Stack>
        </Stack>
      </Box>
    </AddonBarPane>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    divider: css({
      height: '1px',
      width: '100%',
    }),
    input: css({
      boxShadow: 'none',
      width: '100%',
      border: `1px solid ${theme.components.input.borderColor}`,
      background: theme.components.input.background,
      padding: theme.spacing(1),
      borderRadius: theme.shape.borderRadius(3),
    }),
  };
}
