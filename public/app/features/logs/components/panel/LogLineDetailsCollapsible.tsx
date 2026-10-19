import { css, cx } from '@emotion/css';
import { cloneElement, isValidElement, type ReactNode, useCallback, useEffect, useState } from 'react';

import { store, type GrafanaTheme2 } from '@grafana/data';
import { Counter, Icon, useStyles2 } from '@grafana/ui';

import { type LogListFontSize } from './LogList';
import { useLogListContext } from './LogListContext';

interface LogLineDetailsCollapsibleProps {
  actions?: ReactNode;
  children: ReactNode;
  count?: number;
  defaultExpanded?: boolean;
  icon?: ReactNode;
  id: string;
  label: string;
}

export const LogLineDetailsCollapsible = ({
  actions,
  children,
  count,
  defaultExpanded = true,
  icon,
  id,
  label,
}: LogLineDetailsCollapsibleProps) => {
  const { fontSize, logOptionsStorageKey, syntaxHighlightingUnavailable } = useLogListContext();
  const styles = useStyles2(getStyles, fontSize);
  const storageKey = getExpandedStorageKey(logOptionsStorageKey, id);
  const [expanded, setExpanded] = useState(() =>
    resolveExpanded(syntaxHighlightingUnavailable, logOptionsStorageKey, storageKey, defaultExpanded)
  );

  useEffect(() => {
    setExpanded(resolveExpanded(syntaxHighlightingUnavailable, logOptionsStorageKey, storageKey, defaultExpanded));
  }, [defaultExpanded, logOptionsStorageKey, storageKey, syntaxHighlightingUnavailable]);

  const toggle = useCallback(() => {
    setExpanded((current) => {
      const next = !current;
      if (logOptionsStorageKey) {
        store.set(storageKey, next);
      }
      return next;
    });
  }, [logOptionsStorageKey, storageKey]);

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <button type="button" className={styles.headerButton} aria-expanded={expanded} onClick={toggle}>
          <Icon
            name={expanded ? 'angle-down' : 'angle-right'}
            className={styles.chevron}
            size={fontSize === 'small' ? 'md' : 'lg'}
          />
          <span className={styles.headerContent}>
            {icon != null && applyIconClassName(icon, styles.icon)}
            <span className={styles.label}>{label}</span>
            {count !== undefined && (
              <span className={styles.counter}>
                <Counter value={count} variant="secondary" />
              </span>
            )}
          </span>
        </button>
        {expanded && actions != null && <div className={styles.actions}>{actions}</div>}
      </div>
      {expanded && <div className={styles.content}>{children}</div>}
    </div>
  );
};

function getExpandedStorageKey(logOptionsStorageKey: string | undefined, id: string) {
  return `${logOptionsStorageKey}.log-details.${id}-open`;
}

function resolveExpanded(
  syntaxHighlightingUnavailable: boolean,
  logOptionsStorageKey: string | undefined,
  storageKey: string,
  defaultExpanded: boolean
) {
  // Heavy log lines and excessive fields disable highlighting. Collapse instead of restoring a stored open state.
  if (syntaxHighlightingUnavailable) {
    return false;
  }
  return logOptionsStorageKey ? store.getBool(storageKey, defaultExpanded) : defaultExpanded;
}

function applyIconClassName(icon: ReactNode, className: string) {
  if (!isValidElement<{ className?: string }>(icon)) {
    return icon;
  }

  return cloneElement(icon, {
    className: cx(icon.props.className, className),
  });
}

const getStyles = (theme: GrafanaTheme2, fontSize: LogListFontSize) => {
  const iconGap = theme.spacing(0.5);
  const iconSize = theme.spacing(2);

  return {
    section: css({
      marginTop: theme.spacing(1.5),
    }),
    header: css({
      display: 'flex',
      alignItems: 'center',
      gap: iconGap,
      minHeight: theme.spacing(3),
      borderRadius: theme.shape.radius.default,
      '&:hover': {
        background: theme.colors.action.hover,
      },
      marginBottom: theme.spacing(1),
    }),
    headerButton: css({
      display: 'flex',
      alignItems: 'center',
      gap: iconGap,
      flex: 1,
      minWidth: 0,
      minHeight: theme.spacing(3),
      padding: `0 ${theme.spacing(0.5)}`,
      lineHeight: 1,
      fontSize: fontSize === 'small' ? theme.typography.bodySmall.fontSize : undefined,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.primary,
      cursor: 'pointer',
      appearance: 'none',
      background: 'none',
      border: 'none',
      textAlign: 'left',
    }),
    actions: css({
      display: 'flex',
      alignItems: 'center',
      flexShrink: 0,
      marginLeft: 'auto',
      paddingRight: theme.spacing(0.5),
      // InlineSwitch sizes itself like a form control. Keep header actions on the same row as the label.
      '& > div': {
        height: 'auto',
        padding: 0,
      },
    }),
    headerContent: css({
      display: 'flex',
      alignItems: 'center',
      gap: iconGap,
      minWidth: 0,
    }),
    content: css({
      padding: theme.spacing(0, 1, 0, 1),
    }),
    chevron: css({
      display: 'inline-flex',
      alignItems: 'center',
      flexShrink: 0,
    }),
    icon: css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      boxSizing: 'border-box',
      width: iconSize,
      height: iconSize,
      paddingRight: theme.spacing(0.5),
    }),
    label: css({
      lineHeight: 1,
      flexShrink: 0,
    }),
    counter: css({
      display: 'inline-flex',
      alignItems: 'center',
      flexShrink: 0,
      '& > span': {
        marginLeft: 0,
      },
    }),
  };
};
