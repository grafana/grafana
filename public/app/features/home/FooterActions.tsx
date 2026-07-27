import { css } from '@emotion/css';
import { type MouseEvent, type ReactNode } from 'react';

import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { Button, Icon, Stack, TextLink, useStyles2 } from '@grafana/ui';

/** Right-aligned container for homepage card footer actions. */
export function FooterActions({ children }: { children: ReactNode }) {
  return (
    <Stack justifyContent="flex-end" wrap="wrap" gap={2.5}>
      {children}
    </Stack>
  );
}

interface FooterActionProps {
  /** Renders a TextLink when set; a text Button otherwise, for actions that mutate instead of navigate. */
  href?: string;
  /** Receives the DOM event so analytics handlers can read modifier keys (new-tab clicks). */
  onClick: (e: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
  icon?: IconName;
  children: ReactNode;
}

/**
 * Single source of the homepage card footer-action treatment. Semantics follow behavior —
 * navigation renders a real link, everything else a <button>.
 */
export function FooterAction({ href, onClick, icon, children }: FooterActionProps) {
  const styles = useStyles2(getStyles);

  // Flex centering aligns the icon with the text line — no pixel-nudge margins needed.
  const content = icon ? (
    <Stack alignItems="center" gap={0.5}>
      <Icon name={icon} size="xs" />
      {children}
    </Stack>
  ) : (
    children
  );

  if (href) {
    return (
      <TextLink inline={false} color="secondary" variant="bodySmall" href={href} onClick={onClick}>
        {content}
      </TextLink>
    );
  }

  return (
    <Button variant="secondary" size="sm" fill="text" className={styles.button} onClick={onClick}>
      {content}
    </Button>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Visually align the button with the TextLink footer actions
  button: css({
    '&&': {
      color: theme.colors.text.secondary,
      height: theme.spacing(2.25),
      padding: 0,
      background: 'transparent',
      fontWeight: theme.typography.fontWeightRegular,
    },
    '&&:hover': {
      color: theme.colors.text.link,
    },
  }),
});
