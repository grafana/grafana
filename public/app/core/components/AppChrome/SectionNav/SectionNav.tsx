import { css } from '@emotion/css';

import { type GrafanaTheme2, type NavModelItem } from '@grafana/data';
import { Icon, Link, useStyles2 } from '@grafana/ui';

interface Props {
  label: string;
  groups: NavModelItem[];
  activeId?: string;
}

export function SectionNav({ label, groups, activeId }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <nav aria-label={label} className={styles.nav}>
      {groups.map((group) => (
        <div key={group.id ?? group.text} className={styles.group}>
          <h2 className={styles.heading}>{group.text}</h2>
          <ul className={styles.list}>
            {(group.children ?? []).map((item) => (
              <SectionNavLink key={item.id ?? item.url} item={item} isActive={item.id === activeId} />
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SectionNavLink({ item, isActive }: { item: NavModelItem; isActive: boolean }) {
  const styles = useStyles2(getStyles);

  return (
    <li>
      <Link
        href={item.url ?? '#'}
        className={isActive ? styles.linkActive : styles.link}
        aria-current={isActive ? 'page' : undefined}
      >
        {item.icon && <Icon name={item.icon} size="md" />}
        {item.text}
      </Link>
    </li>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const row = {
    alignItems: 'center',
    borderRadius: theme.shape.radius.default,
    display: 'flex',
    gap: theme.spacing(1),
    padding: theme.spacing(0.75, 1),
  } as const;

  return {
    nav: css({
      padding: theme.spacing(2),
    }),
    group: css({
      marginTop: theme.spacing(2),

      '&:first-child': {
        marginTop: 0,
      },
    }),
    heading: css({
      ...theme.typography.sm,
      color: theme.colors.text.secondary,
      fontWeight: theme.typography.fontWeightRegular,
      margin: theme.spacing(0, 1, 1),
    }),
    list: css({
      listStyle: 'none',
      margin: 0,
      padding: 0,
    }),
    link: css(row, {
      color: theme.colors.text.primary,

      '&:hover': {
        background: theme.colors.action.hover,
        color: theme.colors.text.maxContrast,
      },
    }),
    linkActive: css(row, {
      background: theme.colors.action.selected,
      color: theme.colors.text.maxContrast,
    }),
  };
};
