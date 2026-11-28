import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { ScrollContainer, Stack, useStyles2 } from '@grafana/ui';

interface Props {
  children: ReactNode;
  footer: ReactNode;
  onSubmit?: (event: React.FormEvent) => void;
}

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
  footer: css({
    borderTop: `1px solid ${theme.colors.border.weak}`,
    margin: theme.spacing(0, -2, -2, -2),
    padding: theme.spacing(2),
  }),
});
