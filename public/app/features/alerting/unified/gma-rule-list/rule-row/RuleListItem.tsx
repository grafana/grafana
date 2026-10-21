import { css } from '@emotion/css';
import { type AriaAttributes, type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';

interface RuleListItemProps extends AriaAttributes {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Falsy entries are dropped. */
  meta?: ReactNode[];
  metaRight?: ReactNode;
  actions?: ReactNode;
  'data-testid'?: string;
}

export function RuleListItem({
  icon,
  title,
  description,
  meta = [],
  metaRight,
  actions,
  'data-testid': testId,
  ...ariaAttributes
}: RuleListItemProps) {
  const styles = useStyles2(getStyles);
  const metaItems = meta.filter(Boolean);

  return (
    <li className={styles.container} data-testid={testId} {...ariaAttributes}>
      <Stack direction="row" alignItems="start" gap={1} wrap={false}>
        {icon && <span className={styles.icon}>{icon}</span>}

        <Stack direction="column" gap={0.5} flex="1" minWidth={0}>
          <Stack direction="column" gap={0}>
            <div className={styles.overflow}>{title}</div>
            {description && <div className={styles.overflow}>{description}</div>}
          </Stack>

          {metaItems.length > 0 && (
            // Whole items wrap; each line's leading separator falls into the clipped margin.
            <div className={styles.metaClip}>
              <Stack direction="row" gap={1} alignItems="center" wrap>
                {metaItems.map((item, index) => (
                  <div key={index} className={styles.metaItem} data-testid="rule-meta-item">
                    {item}
                  </div>
                ))}
              </Stack>
            </div>
          )}
        </Stack>

        {(metaRight || actions) && (
          <Stack direction="row" alignItems="center" gap={1} wrap={false}>
            {metaRight}
            {actions}
          </Stack>
        )}
      </Stack>
    </li>
  );
}

interface RuleListItemDescriptionProps {
  error?: string;
  summary?: string;
}

export function RuleListItemDescription({ error, summary }: RuleListItemDescriptionProps) {
  const text = error || summary;

  if (!text) {
    return null;
  }

  return (
    <Tooltip content={text}>
      <Text
        variant="bodySmall"
        color={error ? 'error' : 'secondary'}
        weight={error ? 'light' : undefined}
        truncate
        element="p"
      >
        {text}
      </Text>
    </Tooltip>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    listStyle: 'none',
    padding: theme.spacing(1),

    // Not action.hover: it drops secondary text below 4.5:1 contrast in the dark theme.
    '&:hover': {
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
    },
  }),
  // Aligns the icon with the title text.
  icon: css({
    marginTop: theme.spacing(0.5),
  }),
  metaClip: css({
    overflow: 'hidden',
    '& > *': { marginLeft: `calc(-1 * (${theme.spacing(1)} + 1px))` },
  }),
  metaItem: css({
    borderLeft: `1px solid ${theme.colors.border.strong}`,
    paddingLeft: theme.spacing(1),
  }),
  overflow: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
});
