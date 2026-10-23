import { css } from '@emotion/css';
import { type ReactNode, useRef, useState } from 'react';

import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { Button, Combobox, type ComboboxOption, Icon, Stack, TextLink, useStyles2 } from '@grafana/ui';

/** Right-aligned container for homepage card footer actions. */
export function FooterActions({ children }: { children: ReactNode }) {
  return (
    <Stack justifyContent="flex-end" wrap="wrap" gap={2.5}>
      {children}
    </Stack>
  );
}

/**
 * Footer row with a filter on the left and the actions on the right, kept on one line. The filter
 * has one width in every card and gives way first: it shrinks and truncates its value when the row
 * is short, so the actions never move or wrap.
 */
export function FilteredFooterActions({ filter, children }: { filter?: ReactNode; children?: ReactNode }) {
  const styles = useStyles2(getFilteredStyles);

  return (
    <div className={styles.row}>
      {filter && <div className={styles.filter}>{filter}</div>}
      <div className={styles.actions}>
        <FooterActions>{children}</FooterActions>
      </div>
    </div>
  );
}

interface FooterFilterComboboxProps<T extends string | number> {
  /** The selected value as displayed; shown in full on hover when the input truncates it. */
  label: string;
  options: Array<ComboboxOption<T>> | ((inputValue: string) => Promise<Array<ComboboxOption<T>>>);
  value: T | ComboboxOption<T>;
  onChange: (option: ComboboxOption<T>) => void;
  'aria-label': string;
}

/**
 * The filter for a FilteredFooterActions slot. Hovering a truncated value shows it in full through a native
 * `title` (Tooltip would make the wrapper a Tab stop), measured on hover, the only time it matters, and dropped
 * while the menu is open: the input then shows the label as a placeholder and the list has the full text.
 */
export function FooterFilterCombobox<T extends string | number>({ label, ...props }: FooterFilterComboboxProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [truncated, setTruncated] = useState(false);

  return (
    <div
      ref={ref}
      title={truncated && !open ? label : undefined}
      onMouseEnter={() => {
        const input = ref.current?.querySelector('input');
        setTruncated(!!input && input.scrollWidth > input.clientWidth);
      }}
    >
      <Combobox {...props} prefixIcon="filter" onIsOpenChange={setOpen} />
    </div>
  );
}

const getFilteredStyles = (theme: GrafanaTheme2) => ({
  row: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    minWidth: 0,
  }),
  // The floor fits the default labels ("Your teams", "All incidents") with the icon and chevron, so
  // only picked values ever truncate.
  filter: css({
    flex: `0 1 ${theme.spacing(30)}`,
    minWidth: theme.spacing(19),

    '& input': {
      textOverflow: 'ellipsis',
    },
  }),
  actions: css({
    flex: '1 0 auto',
  }),
});

/** Renders a TextLink when href set; a text Button otherwise, for actions that mutate instead of navigate. */
type FooterActionProps = {
  icon?: IconName;
  children: ReactNode;
} & (
  | {
      href: string;
      external?: boolean;
      onClick?: () => void;
    }
  | {
      href?: never;
      external?: never;
      onClick: () => void;
    }
);

/**
 * Single source of the homepage card footer-action treatment. Semantics follow behavior —
 * navigation renders a real link, everything else a <button>.
 */
export function FooterAction({ href, external, onClick, icon, children }: FooterActionProps) {
  const styles = useStyles2(getStyles, external);

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
      <div className={styles.link}>
        <TextLink
          inline={false}
          color="secondary"
          variant="bodySmall"
          href={href}
          external={external}
          onClick={onClick}
        >
          {content}
        </TextLink>
      </div>
    );
  }

  return (
    <Button variant="secondary" size="sm" fill="text" className={styles.button} onClick={onClick}>
      {content}
    </Button>
  );
}

const getStyles = (theme: GrafanaTheme2, external?: boolean) => ({
  // Remove default external icon from TextLink
  link: css({
    lineHeight: 1,

    '& > a > svg:last-child': {
      display: external ? 'none' : undefined,
    },
  }),
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
