import { css } from '@emotion/css';
import SVG from 'react-inlinesvg';

import { GrafanaTheme2 } from '@grafana/data';
import { FlexItem } from '@grafana/experimental';
import { Box, Card, Stack, useStyles2, Text } from '@grafana/ui';
import GrotCompleted from '@grafana/ui/src/components/EmptyState/grot-completed.svg';

export function HelpPane() {
  const styles = useStyles2(getStyles);
  //   const navIndex = useSelector((s) => s.navIndex);
  //   const helpNode = cloneDeep(navIndex['help']);
  //   const enrichedHelpNode = helpNode ? enrichHelpItem(helpNode) : undefined;

  return (
    <Box padding={1} grow={1}>
      <Stack direction={'column'} grow={1} gap={1} height={'100%'}>
        <Text variant="bodySmall" italic>
          Recommended topics
        </Text>
        <Stack direction={'column'} gap={0.5}>
          <Card href="link" isCompact>
            <Card.Heading>Dashboard docs</Card.Heading>
          </Card>
          <Card href="link" isCompact>
            <Card.Heading>Adding panels</Card.Heading>
          </Card>
          <Card href="link" isCompact>
            <Card.Heading>Configuring visualizations</Card.Heading>
          </Card>
          <Card href="link" isCompact>
            <Card.Heading>Template variables</Card.Heading>
          </Card>
        </Stack>
        <div className={styles.divider} />
        <Text variant="bodySmall" italic>
          Other topics
        </Text>
        <Stack direction={'column'} gap={0.5}>
          <Card href="link" isCompact>
            <Card.Heading>Support bundles</Card.Heading>
          </Card>
          <Card href="link" isCompact>
            <Card.Heading>Grafana docs</Card.Heading>
          </Card>
          <Card href="link" isCompact>
            <Card.Heading>Keyboard shortcuts</Card.Heading>
          </Card>
        </Stack>
        <FlexItem grow={1} />
        <Stack direction={'row'} gap={0.5} alignItems={'center'}>
          <SVG src={GrotCompleted} width={40} />
          <input autoFocus className={styles.input} type="text" placeholder="Ask a question" />
        </Stack>
      </Stack>
    </Box>
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
