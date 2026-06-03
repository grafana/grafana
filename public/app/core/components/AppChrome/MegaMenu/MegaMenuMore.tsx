import { css, cx } from '@emotion/css';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';
import { useLocalStorage } from 'react-use';

import { type GrafanaTheme2, type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Text, useStyles2 } from '@grafana/ui';

import { MegaMenuItem } from './MegaMenuItem';
import { hasChildMatch } from './utils';

interface Props {
  items: NavModelItem[];
  activeItem?: NavModelItem;
  onClick?: () => void;
  onPin: (item: NavModelItem) => void;
  isPinned: (url?: string) => boolean;
}

export const MORE_SECTION_ID = 'more';

/**
 * Collapsible "More" group used by the simplified navigation. It hides every
 * non-primary section behind a single disclosure to keep the menu focused on
 * Home / Dashboards / Explore. Children render at level 0 so each section keeps
 * its full depth (the MegaMenuItem MAX_DEPTH limit is measured from level 0).
 */
export function MegaMenuMore({ items, activeItem, onClick, onPin, isPinned }: Props) {
  const styles = useStyles2(getStyles);
  const location = useLocation();

  const hasActiveChild = items.some((item) => item === activeItem || hasChildMatch(item, activeItem));
  const [sectionExpanded = false, setSectionExpanded] = useLocalStorage(
    `grafana.navigation.expanded[${MORE_SECTION_ID}]`,
    hasActiveChild
  );

  // expand when the active page lives inside one of the hidden sections
  useEffect(() => {
    if (hasActiveChild) {
      setSectionExpanded(true);
    }
  }, [hasActiveChild, location, setSectionExpanded]);

  if (items.length === 0) {
    return null;
  }

  const label = t('navigation.megamenu.more', 'More');

  return (
    <li className={styles.listItem}>
      <button
        type="button"
        className={styles.moreButton}
        aria-expanded={sectionExpanded}
        onClick={() => setSectionExpanded(!sectionExpanded)}
      >
        <Icon className={styles.icon} name="ellipsis-h" size="lg" />
        <span className={cx(styles.label, { [styles.labelActive]: hasActiveChild })}>
          <Text element="span">{label}</Text>
        </span>
        <Icon name={sectionExpanded ? 'angle-up' : 'angle-down'} size="md" />
      </button>
      {sectionExpanded && (
        <ul className={styles.children}>
          {items.map((item) => (
            <MegaMenuItem
              key={item.text}
              link={item}
              activeItem={activeItem}
              onClick={onClick}
              onPin={onPin}
              isPinned={isPinned}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  listItem: css({
    borderTop: `1px solid ${theme.colors.border.weak}`,
    flex: 1,
    marginTop: theme.spacing(1),
    maxWidth: '100%',
    paddingTop: theme.spacing(1),
  }),
  moreButton: css({
    alignItems: 'center',
    background: 'none',
    border: 'none',
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    display: 'flex',
    gap: theme.spacing(1),
    height: theme.spacing(4),
    padding: theme.spacing(0, 1, 0, 0.5),
    textAlign: 'left',
    width: '100%',

    '&:hover, &:focus-visible': {
      color: theme.colors.text.primary,
    },
    '&:focus-visible': {
      boxShadow: 'none',
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: '-2px',
    },
  }),
  icon: css({
    width: theme.spacing(3),
  }),
  label: css({
    flex: 1,
    minWidth: 0,
  }),
  labelActive: css({
    color: theme.colors.text.primary,
  }),
  children: css({
    display: 'flex',
    flexDirection: 'column',
    listStyleType: 'none',
  }),
});
