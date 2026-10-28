import { css, cx } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Dropdown, Icon, Menu, Tooltip, useStyles2 } from '@grafana/ui';

import { type FacetTerm } from '../api/globalSearchApi';
import { type KindInfo, kindInfoFor, knownKinds } from '../kinds';

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
  const ranked = rankTabs(types, selected);
  const visible = ranked.slice(0, VISIBLE_TABS);
  const overflow = ranked.slice(VISIBLE_TABS);
  const selectedOverflow = overflow.find((term) => term.value === selected);
  if (selectedOverflow) {
    visible.push(selectedOverflow);
  }
  const more = overflow.filter((term) => term !== selectedOverflow);

  const tab = (key: string, active: boolean, onClick: () => void, content: ReactNode, disabledReason?: string) => {
    const button = (
      <button
        key={key}
        type="button"
        role="tab"
        aria-selected={active}
        // A disabled button gets no hover events, so the tooltip wouldn't show.
        aria-disabled={disabledReason ? true : undefined}
        className={cx(styles.tab, active && styles.active, disabledReason && styles.disabled)}
        onClick={disabledReason ? undefined : onClick}
      >
        {content}
      </button>
    );
    return disabledReason ? (
      <Tooltip key={key} content={disabledReason}>
        {button}
      </Tooltip>
    ) : (
      button
    );
  };

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
          </>,
          isEmpty(term, selected) ? emptyReason(info) : undefined
        );
      })}
      {more.length > 0 && (
        <Dropdown
          placement="bottom-start"
          overlay={
            <Menu>
              {more.map((term) => {
                const info = kindInfoFor(term.value);
                const empty = isEmpty(term, selected);
                return (
                  <Menu.Item
                    key={term.value}
                    label={t('urv.tabs.more-item', '{{type}} ({{total}})', {
                      type: info.plural(),
                      total: term.count.toLocaleString(),
                      interpolation: { escapeValue: false },
                    })}
                    icon={info.icon}
                    disabled={empty}
                    description={empty ? emptyReason(info) : undefined}
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

/** Types with results first, by count, then every other known type, so no tab disappears when filters narrow the results. */
function rankTabs(types: FacetTerm[], selected?: string): FacetTerm[] {
  const withResults = types.filter((term) => term.count > 0);
  const empty = new Set([...knownKinds(), ...types.map((term) => term.value), ...(selected ? [selected] : [])]);
  withResults.forEach((term) => empty.delete(term.value));
  return [...withResults, ...[...empty].map((value) => ({ value, count: 0 }))];
}

// The open tab stays clickable so the user can still see where they are.
function isEmpty(term: FacetTerm, selected?: string) {
  return term.count === 0 && term.value !== selected;
}

function emptyReason(info: KindInfo) {
  return t('urv.tabs.empty', 'No {{type}} to show, so this tab is disabled', {
    type: info.plural(),
    interpolation: { escapeValue: false },
  });
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
  disabled: css({
    color: theme.colors.text.disabled,
    cursor: 'not-allowed',
    '&:hover': {
      color: theme.colors.text.disabled,
    },
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
