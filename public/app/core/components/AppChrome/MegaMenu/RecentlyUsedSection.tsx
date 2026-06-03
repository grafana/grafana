import { css } from '@emotion/css';

import { type GrafanaTheme2, type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { MegaMenuItem } from './MegaMenuItem';

interface Props {
  items: NavModelItem[];
  activeItem?: NavModelItem;
  isPinned: (id?: string) => boolean;
  onPin: (item: NavModelItem) => void;
  onClick?: () => void;
}

export function RecentlyUsedSection({ items, activeItem, isPinned, onPin, onClick }: Props) {
  const styles = useStyles2(getStyles);

  if (items.length === 0) {
    return null;
  }

  return (
    <li className={styles.wrapper}>
      <div className={styles.header}>{t('navigation.megamenu.recently-used', 'Recently used')}</div>
      <ul className={styles.children} aria-label={t('navigation.megamenu.recently-used', 'Recently used')}>
        {items.map((link) => (
          <MegaMenuItem
            key={`recent-${link.id ?? link.text}`}
            link={link}
            isPinned={isPinned}
            onClick={onClick}
            activeItem={activeItem}
            onPin={onPin}
          />
        ))}
      </ul>
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
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    height: theme.spacing(4),
    display: 'flex',
    alignItems: 'center',
    paddingLeft: theme.spacing(1),
  }),
  children: css({
    display: 'flex',
    flexDirection: 'column',
    listStyleType: 'none',
  }),
});
