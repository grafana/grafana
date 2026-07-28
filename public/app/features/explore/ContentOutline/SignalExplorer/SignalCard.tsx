import { css, cx } from '@emotion/css';
import { type KeyboardEvent, type ReactNode, useId } from 'react';

import { colorManipulator, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, useStyles2 } from '@grafana/ui';

interface Props {
  refId: string;
  datasourceName: string;
  datasourceLogo?: string;
  /**
   * Only some datasource types have something to browse (currently Prometheus),
   * so other cards render without a chevron and cannot be opened.
   */
  isExpandable: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onJumpToQuery: () => void;
  children?: ReactNode;
}

/**
 * A single query in the Datasource explorer sidebar, labelled with its refId and
 * datasource. Clicking it jumps to that query row; expanding it reveals the
 * datasource's explorer inline, pushing the cards below it down.
 */
export function SignalCard({
  refId,
  datasourceName,
  datasourceLogo,
  isExpandable,
  isExpanded,
  onToggleExpanded,
  onJumpToQuery,
  children,
}: Props) {
  const styles = useStyles2(getStyles);
  const expanded = isExpandable && isExpanded;
  // refIds are user-editable, so deriving the id from one risks characters that make
  // aria-controls unresolvable, or collisions with another card in a split pane.
  const bodyId = useId();

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Keydowns from the nested chevron bubble up here. Claiming them would
    // preventDefault the chevron's own activation, so it could never be toggled by
    // keyboard - it would scroll to the query instead.
    if (e.target !== e.currentTarget) {
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onJumpToQuery();
    }
  };

  return (
    <div className={cx(styles.card, expanded && styles.cardExpanded)} data-testid={`signal-card-${refId}`}>
      <div
        className={cx(
          styles.cardHeader,
          isExpandable && styles.cardHeaderExpandable,
          expanded && styles.cardHeaderExpanded
        )}
        role="button"
        tabIndex={0}
        // The datasource name is not rendered inline (the logo covers the type and
        // long query names need the room), so surface it here for disambiguation
        // between two instances of the same datasource type in Mixed mode.
        title={t('explore.signal-card.jump-to-query-tooltip', 'Jump to query {{refId}} ({{datasourceName}})', {
          refId,
          datasourceName,
        })}
        onClick={onJumpToQuery}
        onKeyDown={handleKeyDown}
      >
        {isExpandable && (
          <button
            type="button"
            className={cx(styles.cardChevron, expanded && styles.cardChevronVisible)}
            data-chevron
            aria-expanded={expanded}
            aria-controls={expanded ? bodyId : undefined}
            aria-label={
              expanded
                ? t('explore.signal-card.collapse-aria-label', 'Collapse datasource explorer for query {{refId}}', {
                    refId,
                  })
                : t('explore.signal-card.expand-aria-label', 'Expand datasource explorer for query {{refId}}', {
                    refId,
                  })
            }
            onClick={(e) => {
              // The card itself jumps to the query, so the chevron must not bubble.
              e.stopPropagation();
              onToggleExpanded();
            }}
          >
            <Icon name={expanded ? 'angle-down' : 'angle-right'} />
          </button>
        )}
        {datasourceLogo ? (
          <img src={datasourceLogo} alt="" className={styles.datasourceLogo} />
        ) : (
          <Icon name="database" className={styles.datasourceLogoFallback} />
        )}
        <span className={styles.cardTitle}>{refId}</span>
      </div>
      {expanded && (
        <div className={styles.cardBody} id={bodyId}>
          {children}
        </div>
      )}
    </div>
  );
}

// Matches the panel editor's SidebarCard sizing.
const CARD_HEIGHT = 30;
/**
 * Caps an expanded card so several open at once each stay reachable. Body content
 * is expected to scroll within that cap, while the card list scrolls around it.
 *
 * 360px fits the search field plus roughly ten metric rows - enough to browse without
 * constant scrolling, while still keeping an open card to about half the height of a
 * typical sidebar so the cards below it stay in view.
 */
const EXPANDED_BODY_MAX_HEIGHT = 360;

const getStyles = (theme: GrafanaTheme2) => {
  return {
    card: css({
      label: 'signal-card',
      position: 'relative',
      // Cards keep their natural height and order; an expanded one grows in place.
      flexShrink: 0,
      minHeight: CARD_HEIGHT,
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',
    }),
    cardExpanded: css({
      label: 'signal-card-expanded',
      display: 'flex',
      flexDirection: 'column',
      '&::before': {
        content: '""',
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 2,
        background: theme.colors.warning.main,
      },
    }),
    cardHeader: css({
      label: 'signal-card-header',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      width: '100%',
      minHeight: CARD_HEIGHT,
      flexShrink: 0,
      padding: theme.spacing(0.5, 1, 0.5, 1.25),
      cursor: 'pointer',
      textAlign: 'left',
      overflow: 'hidden',
      minWidth: 0,
      '&:hover': {
        background: colorManipulator.alpha(theme.colors.text.primary, 0.08),
      },
    }),
    // The chevron takes no layout space at rest so logos and query names sit flush
    // left; revealing it shifts the content right to make room. Keying the reveal
    // off :focus-visible rather than :focus-within stops it from staying open
    // after a mouse click, while `:has` keeps the room reserved once the chevron
    // itself takes keyboard focus.
    cardHeaderExpandable: css({
      label: 'signal-card-header-expandable',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['padding-left'], {
          duration: theme.transitions.duration.shortest,
        }),
      },
      '&:hover, &:focus-visible, &:has([data-chevron]:focus-visible)': {
        paddingLeft: theme.spacing(3.5),
      },
      '&:hover [data-chevron], &:focus-visible [data-chevron], & [data-chevron]:focus-visible': {
        opacity: 1,
      },
    }),
    // An open card keeps the room, since its chevron stays visible.
    cardHeaderExpanded: css({
      label: 'signal-card-header-expanded',
      paddingLeft: theme.spacing(3.5),
    }),
    cardChevron: css({
      label: 'signal-card-chevron',
      position: 'absolute',
      left: theme.spacing(1),
      top: '50%',
      transform: 'translateY(-50%)',
      display: 'flex',
      alignItems: 'center',
      padding: 0,
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      color: theme.colors.text.secondary,
      opacity: 0,
      '&:hover': {
        color: theme.colors.text.primary,
      },
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['opacity'], {
          duration: theme.transitions.duration.shortest,
        }),
      },
    }),
    // An open card keeps its chevron so the control that closes it doesn't
    // disappear once the pointer leaves.
    cardChevronVisible: css({
      label: 'signal-card-chevron-visible',
      opacity: 1,
    }),
    datasourceLogo: css({
      label: 'signal-card-datasource-logo',
      width: 16,
      height: 16,
      flexShrink: 0,
    }),
    datasourceLogoFallback: css({
      label: 'signal-card-datasource-logo-fallback',
      color: theme.colors.text.secondary,
      flexShrink: 0,
    }),
    cardTitle: css({
      label: 'signal-card-title',
      // Query names can be arbitrarily long, so this takes the remaining room and
      // truncates rather than pushing the logo out of the card.
      flex: '1 1 auto',
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      color: theme.colors.text.primary,
      ...theme.typography.code,
      fontWeight: theme.typography.fontWeightLight,
    }),
    cardBody: css({
      label: 'signal-card-body',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      maxHeight: EXPANDED_BODY_MAX_HEIGHT,
      borderTop: `1px solid ${theme.colors.border.weak}`,
    }),
  };
};
