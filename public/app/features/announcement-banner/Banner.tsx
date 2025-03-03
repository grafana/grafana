import { css } from '@emotion/css';

import { GrafanaTheme2, renderMarkdown } from '@grafana/data';
import { Box, useStyles2 } from '@grafana/ui';

import { Spec } from './api';

type Props = Pick<Spec, 'message' | 'variant'>;

export function Banner({ message, variant }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <Box display="flex" backgroundColor={variant} borderRadius="default" paddingY={1} paddingX={2} alignItems="stretch">
      <div className={styles.content}>
        <div dangerouslySetInnerHTML={{ __html: renderMarkdown(message) }} />
      </div>
    </Box>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    content: css({
      p: {
        margin: 0,
      },
      a: {
        color: theme.colors.text.link,
      },
    }),
  };
}
