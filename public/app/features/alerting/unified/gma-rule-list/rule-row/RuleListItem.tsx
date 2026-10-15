import { css } from '@emotion/css';
import { type AriaAttributes, Fragment, type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';

interface RuleListItemProps extends AriaAttributes {
  /** Status icon; aligned with the title line. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Metadata entries; falsy ones are dropped and the rest are separated by `|`. */
  meta?: ReactNode[];
  /** Shown before the actions, e.g. the evaluation interval. */
  metaRight?: ReactNode;
  actions?: ReactNode;
  'data-testid'?: string;
}

/** Shared `<li>` shell for Alert and Recording rule rows. Callers fill the slots, this owns layout. */
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
            <Stack direction="row" gap={1} alignItems="center">
              {metaItems.map((item, index) => (
                <Fragment key={index}>
                  {index > 0 && (
                    <Text color="secondary" variant="bodySmall">
                      {'|'}
                    </Text>
                  )}
                  {item}
                </Fragment>
              ))}
            </Stack>
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

/** One truncated line: the last evaluation error in red if present, otherwise the summary. Full text on hover. */
export function RuleListItemDescription({ error, summary }: RuleListItemDescriptionProps) {
  const text = error || summary;

  if (!text) {
    return null;
  }

  return (
    <Tooltip content={text}>
      {error ? (
        <Text variant="bodySmall" color="error" weight="light" truncate element="p">
          {text}
        </Text>
      ) : (
        <Text variant="bodySmall" color="secondary" truncate element="p">
          {text}
        </Text>
      )}
    </Tooltip>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    listStyle: 'none',
    position: 'relative',
    padding: theme.spacing(1),

    // Not action.hover: it drops secondary text below 4.5:1 contrast in the dark theme.
    '&:hover': {
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
    },
  }),
  // Lines the icon up with the title text rather than the top of the row.
  icon: css({
    marginTop: theme.spacing(0.5),
  }),
  overflow: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: 'inherit',
  }),
});
