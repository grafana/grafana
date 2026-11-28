import { css } from '@emotion/css';
import { Fragment, useState } from 'react';

import { type GrafanaTheme2, type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Dropdown, Icon, Menu, useStyles2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';

interface Props {
  label: string;
  groups: NavModelItem[];
  activeId?: string;
}

export function SectionNavMenu({ label, groups, activeId }: Props) {
  const styles = useStyles2(getStyles);
  const [isOpen, setIsOpen] = useState(false);
  const active = groups.flatMap((group) => group.children ?? []).find((item) => item.id === activeId);

  const menu = (
    <Menu ariaLabel={label}>
      {groups.map((group, index) => (
        <Fragment key={group.id ?? group.text}>
          {index > 0 && <Menu.Divider />}
          <Menu.Group label={group.text}>
            {(group.children ?? []).map((item) => (
              <Menu.Item
                key={item.id ?? item.url}
                url={item.url}
                label={item.text}
                icon={item.icon}
                active={item.id === activeId}
              />
            ))}
          </Menu.Group>
        </Fragment>
      ))}
    </Menu>
  );

  return (
    <Dropdown overlay={menu} placement="bottom-start" onVisibleChange={setIsOpen}>
      <button type="button" className={styles.trigger} aria-haspopup="menu" aria-expanded={isOpen}>
        <span className={styles.text}>
          <span className={styles.section}>{t('navigation.section-nav-menu.label', 'Menu')}</span>
          {active && <span className={styles.current}>{active.text}</span>}
        </span>
        <Icon name={isOpen ? 'angle-up' : 'angle-down'} />
      </button>
    </Dropdown>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  trigger: css({
    alignItems: 'center',
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.primary,
    cursor: 'pointer',
    display: 'flex',
    gap: theme.spacing(1),
    justifyContent: 'space-between',
    padding: theme.spacing(1, 1.5),
    textAlign: 'left',
    width: '100%',

    '&:hover': {
      background: theme.colors.action.hover,
    },

    '&:focus-visible': getFocusStyles(theme),
  }),
  text: css({
    alignItems: 'baseline',
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0, 1),
    minWidth: 0,
  }),
  section: css({
    fontWeight: theme.typography.fontWeightMedium,
  }),
  current: css({
    color: theme.colors.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
});
