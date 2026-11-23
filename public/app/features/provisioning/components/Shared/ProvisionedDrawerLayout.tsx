import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { ScrollContainer, Stack, useStyles2 } from '@grafana/ui';

interface Props {
  children: ReactNode;
  /** Actions pinned to the bottom of the drawer, below the scrollable body. */
  footer: ReactNode;
  /** Renders the layout as a form, so a submit button can live in the pinned footer. */
  onSubmit?: (event: React.FormEvent) => void;
}

/**
 * Body + pinned footer for a provisioned resource drawer, so the commit action stays reachable
 * while a long form or a success state scrolls. Requires the drawer to opt out of its own
 * scrolling with `scrollableContent={false}`.
 */
export function ProvisionedDrawerLayout({ children, footer, onSubmit }: Props) {
  const styles = useStyles2(getStyles);
  const Root = onSubmit ? 'form' : 'div';

  return (
    <Root className={styles.layout} onSubmit={onSubmit}>
      <ScrollContainer>
        <div className={styles.body}>{children}</div>
      </ScrollContainer>
      <div className={styles.footer}>
        <Stack gap={2} wrap="wrap">
          {footer}
        </Stack>
      </div>
    </Root>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  layout: css({
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
  }),
  body: css({
    paddingBottom: theme.spacing(2),
  }),
  // Negative margins pull the divider out to the drawer edges, past the drawer's own padding.
  footer: css({
    borderTop: `1px solid ${theme.colors.border.weak}`,
    margin: theme.spacing(0, -2, -2, -2),
    padding: theme.spacing(2),
  }),
});
