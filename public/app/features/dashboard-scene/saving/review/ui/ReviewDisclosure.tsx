import { css } from '@emotion/css';
import { type ReactNode, useId } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

interface Props {
  /** Heading level of the header; deep nesting is capped at 6. */
  level: number;
  /** Header content: label, status and, when collapsed, the summary. */
  header: ReactNode;
  /** Undefined renders a plain header: there is nothing to reveal. */
  expanded?: boolean;
  onToggle?: () => void;
  /** Shown where the chevron is (e.g. the +/− marker); on a collapsible header it replaces the chevron as the toggle. */
  lead?: ReactNode;
  children?: ReactNode;
}

/** A heading whose button shows or hides the content below it. */
export function ReviewDisclosure({ level, header, expanded, onToggle, lead, children }: Props) {
  const styles = useStyles2(getStyles);
  const contentId = useId();
  const collapsible = expanded !== undefined && onToggle !== undefined;

  return (
    <div>
      <div role="heading" aria-level={Math.min(level, 6)} className={styles.heading}>
        {collapsible ? (
          <button
            type="button"
            className={styles.button}
            aria-expanded={expanded}
            aria-controls={contentId}
            onClick={onToggle}
          >
            {lead ? (
              <span className={styles.chevronSpacer}>{lead}</span>
            ) : (
              <Icon name={expanded ? 'angle-down' : 'angle-right'} className={styles.chevron} />
            )}
            <span className={styles.header}>{header}</span>
          </button>
        ) : (
          <span className={styles.plain}>
            <span className={styles.chevronSpacer}>{lead}</span>
            <span className={styles.header}>{header}</span>
          </span>
        )}
      </div>
      {collapsible && expanded && (
        <div id={contentId} className={styles.content}>
          {children}
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  heading: css({
    margin: 0,
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.fontWeightRegular,
    lineHeight: theme.typography.body.lineHeight,
  }),
  button: css({
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(0.5),
    width: '100%',
    padding: theme.spacing(0.5, 0.5, 0.5, 0),
    background: 'none',
    border: 'none',
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.primary,
    textAlign: 'left',
    cursor: 'pointer',
    '&:hover': {
      background: theme.colors.action.hover,
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: '-2px',
    },
  }),
  plain: css({
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.5, 0.5, 0.5, 0),
  }),
  chevron: css({
    flexShrink: 0,
    marginTop: '2px',
    color: theme.colors.text.secondary,
  }),
  // As tall as the first line of text, so a marker in place of the chevron is centred on it
  chevronSpacer: css({
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
    width: theme.spacing(2),
    height: `calc(${theme.typography.body.fontSize} * ${theme.typography.body.lineHeight})`,
  }),
  header: css({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: theme.spacing(1),
    rowGap: theme.spacing(0.25),
    minWidth: 0,
  }),
  // A guide line from under the chevron: what a node contains reads as inside it, and a sibling header
  // (whose label sits where the content starts) can't be mistaken for part of it
  content: css({
    marginLeft: theme.spacing(1),
    paddingLeft: theme.spacing(1.5),
    borderLeft: `1px solid ${theme.colors.border.weak}`,
  }),
});
