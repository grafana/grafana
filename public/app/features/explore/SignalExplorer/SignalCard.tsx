import { css, cx } from '@emotion/css';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

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
  /** With no other card to keep in view, an expanded card takes the whole card area. */
  isOnlyCard: boolean;
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
  isOnlyCard,
  onToggleExpanded,
  onJumpToQuery,
  children,
}: Props) {
  const styles = useStyles2(getStyles, isOnlyCard);
  const expanded = isExpandable && isExpanded;
  const cardRef = useRef<HTMLDivElement>(null);
  // Only a card the user opens is scrolled to: one opened by default must not move the sidebar.
  const scrollOnExpandRef = useRef(false);

  useEffect(() => {
    if (expanded && scrollOnExpandRef.current) {
      // An expanded card is nearly as tall as the card area, so it usually opens past the bottom edge.
      cardRef.current?.scrollIntoView({ block: 'nearest' });
    }
    scrollOnExpandRef.current = false;
  }, [expanded]);

  const toggleExpanded = () => {
    scrollOnExpandRef.current = !expanded;
    onToggleExpanded();
  };
  // refIds are user-editable, so deriving the id from one risks characters that make
  // aria-controls unresolvable, or collisions with another card in a split pane.
  const bodyId = useId();
  // A logo can be missing at runtime even when the plugin declares one, for example when the
  // plugin failed to load. Remember the url that failed so the fallback icon is used instead
  // of a broken image, and so a later datasource change gets a fresh attempt.
  const [brokenLogo, setBrokenLogo] = useState<string>();
  const logo = datasourceLogo === brokenLogo ? undefined : datasourceLogo;
  // The datasource name is not rendered inline (the logo covers the type and long query
  // names need the room), so name the card with it to disambiguate two instances of the
  // same datasource type in Mixed mode.
  const jumpLabel = t('explore.signal-card.jump-to-query-label', 'Jump to query {{refId}} ({{datasourceName}})', {
    refId,
    datasourceName,
  });

  return (
    <div
      ref={cardRef}
      className={cx(styles.card, expanded && styles.cardExpanded)}
      data-testid={`signal-card-${refId}`}
    >
      {/* Siblings rather than a jump target wrapping the chevron: WebKit treats the
          content of a button as presentational, so a nested control is invisible to
          VoiceOver, and nesting would make the two fight over clicks and keydowns. */}
      <div
        className={cx(
          styles.cardHeader,
          isExpandable && styles.cardHeaderExpandable,
          expanded && styles.cardHeaderExpanded
        )}
      >
        {isExpandable && (
          <button
            type="button"
            className={styles.cardChevron}
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
            onClick={toggleExpanded}
          >
            <Icon name={expanded ? 'angle-down' : 'angle-right'} />
          </button>
        )}
        <button
          type="button"
          className={styles.jumpButton}
          // `title` only names an element that has no other name, and this one is named by
          // its refId text, so the label has to be explicit or the datasource name is lost.
          aria-label={jumpLabel}
          title={jumpLabel}
          onClick={onJumpToQuery}
        >
          {logo ? (
            <img src={logo} alt="" className={styles.datasourceLogo} onError={() => setBrokenLogo(logo)} />
          ) : (
            <Icon name="database" className={styles.datasourceLogoFallback} />
          )}
          <span className={styles.cardTitle}>{refId}</span>
        </button>
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
// Keeps the search field and a few metric rows usable in a short window, where `100cqh` gets small.
const EXPANDED_CARD_MIN_HEIGHT = 200;

const getStyles = (theme: GrafanaTheme2, isOnlyCard: boolean) => {
  // Room the revealed chevron needs, so it never sits on top of the datasource logo.
  const chevronGutter = theme.spacing(3.5);
  // `cqh` resolves against SignalExplorer's card area, so these mirror its list's bottom padding and
  // gap. With other cards, the next one stays in view below: its header plus top and bottom borders.
  const listBottomPadding = theme.spacing(1);
  const expandedHeight = isOnlyCard
    ? `calc(100cqh - ${listBottomPadding})`
    : `calc(100cqh - ${listBottomPadding} - ${theme.spacing(1)} - ${CARD_HEIGHT + 2}px)`;

  const cardChevron = css({
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
  });

  const jumpButton = css({
    label: 'signal-card-jump-button',
    // Fills the header so clicking anywhere outside the chevron jumps to the query.
    flex: '1 1 auto',
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    minHeight: CARD_HEIGHT,
    padding: theme.spacing(0.5, 1, 0.5, 1.25),
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    font: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
    overflow: 'hidden',
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create(['padding-left'], {
        duration: theme.transitions.duration.shortest,
      }),
    },
  });

  // The hidden chevron still sits over the logo, so anything that makes it clickable has
  // to shift the jump button's content clear of it in the same breath.
  const chevronRevealed = {
    [`.${cardChevron}`]: {
      opacity: 1,
    },
    [`.${jumpButton}`]: {
      paddingLeft: chevronGutter,
    },
  };

  return {
    cardChevron,
    jumpButton,
    card: css({
      label: 'signal-card',
      position: 'relative',
      // The list never squeezes a card; an expanded one grows in place and the list scrolls instead.
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
      // Fixed rather than capped, so the card doesn't jump in size as its metrics load.
      height: expandedHeight,
      minHeight: EXPANDED_CARD_MIN_HEIGHT,
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
      width: '100%',
      minHeight: CARD_HEIGHT,
      flexShrink: 0,
      overflow: 'hidden',
      minWidth: 0,
      '&:hover': {
        background: colorManipulator.alpha(theme.colors.text.primary, 0.08),
      },
    }),
    // The chevron takes no layout space at rest so logos and query names sit flush
    // left; revealing it shifts the content right to make room. Keying the reveal
    // off :focus-visible rather than :focus-within stops it from staying open after a
    // mouse click, and `:has` reveals it for whichever of the two controls has
    // keyboard focus.
    cardHeaderExpandable: css({
      label: 'signal-card-header-expandable',
      '&:hover, &:has(:focus-visible)': chevronRevealed,
      // A pointer that cannot hover would never reveal the chevron, so show it
      // upfront there and keep its gutter reserved.
      '@media (hover: none)': chevronRevealed,
    }),
    // An open card keeps its chevron and gutter, so the control that closes it doesn't
    // disappear once the pointer leaves.
    cardHeaderExpanded: css({
      label: 'signal-card-header-expanded',
      ...chevronRevealed,
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
      flex: '1 1 auto',
      minHeight: 0,
      borderTop: `1px solid ${theme.colors.border.weak}`,
    }),
  };
};
