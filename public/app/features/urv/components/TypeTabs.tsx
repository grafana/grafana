import { css, cx } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Dropdown, Icon, Menu, useStyles2 } from '@grafana/ui';

import { type FacetTerm } from '../api/globalSearchApi';
import { kindInfoFor } from '../kinds';

import { KindIcon } from './KindIcon';

const VISIBLE_TABS = 5;

interface Props {
  types: FacetTerm[];
  total: number;
  selected?: string;
  onSelect: (type: string | undefined) => void;
}

export function TypeTabs({ types, total, selected, onSelect }: Props) {
  const styles = useStyles2(getStyles);
  const ranked = types.filter((term) => term.count > 0 || term.value === selected);
  if (selected && !ranked.some((term) => term.value === selected)) {
    ranked.push({ value: selected, count: 0 });
  }
  const visible = ranked.slice(0, VISIBLE_TABS);
  const overflow = ranked.slice(VISIBLE_TABS);
  const selectedOverflow = overflow.find((term) => term.value === selected);
  if (selectedOverflow) {
    visible.push(selectedOverflow);
  }
  const more = overflow.filter((term) => term !== selectedOverflow);

  const tab = (key: string, active: boolean, onClick: () => void, content: ReactNode) => (
    <button
      key={key}
      type="button"
      role="tab"
      aria-selected={active}
      className={cx(styles.tab, active && styles.active)}
      onClick={onClick}
    >
      {content}
    </button>
  );

  return (
    <div className={styles.bar} role="tablist">
      {tab(
        'all',
        !selected,
        () => onSelect(undefined),
        <>
          {t('urv.tabs.all', 'All')}
          <span className={styles.counter}>{total.toLocaleString()}</span>
        </>
      )}
      {visible.map((term) => {
        const info = kindInfoFor(term.value);
        return tab(
          term.value,
          term.value === selected,
          () => onSelect(term.value),
          <>
            <KindIcon info={info} size="sm" />
            {info.plural()}
            <span className={styles.counter}>{term.count.toLocaleString()}</span>
          </>
        );
      })}
      {more.length > 0 && (
        <Dropdown
          placement="bottom-start"
          overlay={
            <Menu>
              {more.map((term) => {
                const info = kindInfoFor(term.value);
                return (
                  <Menu.Item
                    key={term.value}
                    label={t('urv.tabs.more-item', '{{type}} ({{total}})', {
                      type: info.plural(),
                      total: term.count.toLocaleString(),
                      interpolation: { escapeValue: false },
                    })}
                    icon={info.icon}
                    onClick={() => onSelect(term.value)}
                  />
                );
              })}
            </Menu>
          }
        >
          <button type="button" className={styles.tab}>
            {t('urv.tabs.more', 'More ({{total}})', { total: more.length })}
            <Icon name="angle-down" />
          </button>
        </Dropdown>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  bar: css({
    display: 'flex',
    alignItems: 'stretch',
    gap: theme.spacing(0.5),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    overflowX: 'auto',
    scrollbarWidth: 'none',
  }),
  tab: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1.5),
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    marginBottom: -1,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.body.fontSize,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
  active: css({
    color: theme.colors.text.primary,
    borderBottomColor: theme.colors.primary.main,
    borderImage: theme.colors.gradients.brandHorizontal,
    borderImageSlice: 1,
  }),
  counter: css({
    padding: theme.spacing(0, 0.75),
    borderRadius: theme.shape.radius.pill,
    background: theme.colors.background.secondary,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontVariantNumeric: 'tabular-nums',
  }),
});
