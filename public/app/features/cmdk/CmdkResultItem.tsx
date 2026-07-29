import { css, cx } from '@emotion/css';
import { type MouseEvent, useEffect, useRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { TagList, useStyles2 } from '@grafana/ui';

import { type CmdkAction, type CmdkItem } from './types';

interface Props {
  item: CmdkItem;
  active: boolean;
  // DOM id so the input can point at the row via aria-activedescendant.
  id: string;
  onSelect: (item: CmdkItem) => void;
  // Additional actions are routed through the palette so they can also push subscopes.
  onAdditionalAction: (action: CmdkAction) => void;
  // Called when the mouse moves over the row so hover and keyboard share one highlight.
  onActivate: () => void;
}

export function CmdkResultItem({ item, active, id, onSelect, onAdditionalAction, onActivate }: Props) {
  const styles = useStyles2(getStyles);
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (active) {
      ref.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [active]);

  const onClick = (event: MouseEvent) => {
    // Let the browser handle modified clicks on navigation links (open in new tab etc.).
    if (item.type === 'navigation' && (event.ctrlKey || event.metaKey || event.shiftKey)) {
      return;
    }
    event.preventDefault();
    onSelect(item);
  };

  // Items that can be drilled down into a subscope get an ellipsis, like the old palette marked actions with
  // children.
  const canDrillDown =
    item.type === 'subscope' || Boolean(item.additionalActions?.some((action) => action.type === 'subscope'));
  const title = canDrillDown && !item.title.endsWith('...') ? `${item.title}...` : item.title;

  const content = (
    <>
      <div className={styles.mainRow}>
        <span className={styles.title}>{title}</span>
        {item.subtitle && <span className={styles.subtitleText}>{item.subtitle}</span>}
        {item.subtitleItems?.map((subtitleItem, index) => (
          <span key={index} className={styles.subtitleText}>
            {subtitleItem}
          </span>
        ))}
        {item.rightSubtitle && <span className={styles.rightSubtitle}>{item.rightSubtitle}</span>}
      </div>
      {item.tags && item.tags.length > 0 && <TagList tags={item.tags} className={styles.tags} />}
      {item.additionalActions && item.additionalActions.length > 0 && (
        <div className={styles.actions}>
          {item.additionalActions.map((action) => (
            <button
              key={action.title}
              type="button"
              className={styles.actionPill}
              onClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                onAdditionalAction(action);
              }}
            >
              {action.title}
              <span className={styles.actionShortcut}>{action.shortcut}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );

  // Focus stays in the search input; rows are managed through aria-activedescendant, hence tabIndex -1.
  const sharedProps = {
    id,
    role: 'option',
    'aria-selected': active,
    tabIndex: -1,
    className: cx(styles.row, active && styles.activeRow),
    onClick,
    onMouseMove: onActivate,
  };

  const setRef = (element: HTMLElement | null) => {
    ref.current = element;
  };

  if (item.type === 'navigation') {
    return (
      <a
        {...sharedProps}
        ref={setRef}
        href={item.href}
        target={item.target}
        rel={item.target === '_blank' ? 'noreferrer' : undefined}
      >
        {content}
      </a>
    );
  }

  return (
    <div {...sharedProps} ref={setRef}>
      {content}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    row: css({
      padding: theme.spacing(1, 2),
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      cursor: 'pointer',
      position: 'relative',
      borderRadius: theme.shape.radius.default,
      margin: theme.spacing(0, 1),
      color: theme.colors.text.primary,
      '&:hover': {
        textDecoration: 'none',
      },
    }),
    activeRow: css({
      color: theme.colors.text.maxContrast,
      background: theme.colors.emphasize(theme.colors.background.primary, 0.03),
      '&:before': {
        display: 'block',
        content: '" "',
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: theme.spacing(0.5),
        borderRadius: theme.shape.radius.default,
        backgroundImage: theme.colors.gradients.brandVertical,
      },
    }),
    mainRow: css({
      flexGrow: 1,
      minWidth: 0,
      display: 'flex',
      alignItems: 'baseline',
      gap: theme.spacing(1),
    }),
    title: css({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    subtitleText: css({
      ...theme.typography.bodySmall,
      color: theme.colors.text.secondary,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    rightSubtitle: css({
      ...theme.typography.bodySmall,
      color: theme.colors.text.secondary,
      marginLeft: 'auto',
      flexShrink: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    tags: css({
      flexShrink: 0,
    }),
    actions: css({
      display: 'flex',
      gap: theme.spacing(0.5),
      flexShrink: 0,
    }),
    actionPill: css({
      ...theme.typography.bodySmall,
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.pill,
      padding: theme.spacing(0, 1),
      color: theme.colors.text.secondary,
      cursor: 'pointer',
    }),
    actionShortcut: css({
      color: theme.colors.text.disabled,
    }),
  };
};
