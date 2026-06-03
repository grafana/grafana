import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2, type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, useStyles2 } from '@grafana/ui';

import { SHOW_MORE_SECTION_ID } from '../../../navigation/constants';

import { MegaMenuItem } from './MegaMenuItem';

interface Props {
  items: NavModelItem[];
  activeItem?: NavModelItem;
  defaultExpanded?: boolean;
  isPinned: (id?: string) => boolean;
  onPin: (item: NavModelItem) => void;
  onClick?: () => void;
  onExpandedChange?: (expanded: boolean) => void;
}

export function ShowMoreSection({
  items,
  activeItem,
  defaultExpanded = false,
  isPinned,
  onPin,
  onClick,
  onExpandedChange,
}: Props) {
  const styles = useStyles2(getStyles);
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);

  if (items.length === 0) {
    return null;
  }

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    onExpandedChange?.(next);
  };

  return (
    <li className={styles.wrapper}>
      <div className={styles.header}>
        <button type="button" className={styles.toggleButton} onClick={toggleExpanded} aria-expanded={expanded}>
          {t('navigation.megamenu.show-more', 'Show me more')}
        </button>
        <IconButton
          aria-label={
            expanded
              ? t('navigation.megamenu.show-more-collapse', 'Collapse show me more')
              : t('navigation.megamenu.show-more-expand', 'Expand show me more')
          }
          name={expanded ? 'angle-up' : 'angle-down'}
          onClick={toggleExpanded}
          size="md"
          variant="secondary"
        />
      </div>
      {expanded && (
        <ul className={styles.children} aria-label={t('navigation.megamenu.overflow-label', 'More navigation items')}>
          {items.map((link) => (
            <MegaMenuItem
              key={`${SHOW_MORE_SECTION_ID}-${link.id ?? link.text}`}
              link={link}
              isPinned={isPinned}
              onClick={onClick}
              activeItem={activeItem}
              onPin={onPin}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    marginTop: theme.spacing(1),
    borderTop: `1px solid ${theme.colors.border.weak}`,
    paddingTop: theme.spacing(1),
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: theme.spacing(4),
    paddingLeft: theme.spacing(1),
  }),
  toggleButton: css({
    background: 'none',
    border: 'none',
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    padding: 0,
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
  children: css({
    display: 'flex',
    flexDirection: 'column',
    listStyleType: 'none',
  }),
});
