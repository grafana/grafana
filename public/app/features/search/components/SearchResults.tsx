import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { e2e } from '@grafana/e2e';
import { Forms, Icon, selectThemeVariant as stv, useTheme } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { IconType } from '@grafana/ui/src/components/Icon/types';
import appEvents from 'app/core/app_events';
import { CoreEvents } from 'app/types';
import { DashboardSection, DashboardSectionItem } from '../types';

type clickWithEvent = (item: DashboardSectionItem | DashboardSection, event: any) => void;
interface Props {
  results: DashboardSection[] | undefined;
  onSelectionChanged: any;
  onTagSelected: any;
  onFolderExpanding: any;
  onToggleSelection: clickWithEvent;
  editable: boolean;
}

const { selectors } = e2e.pages.Dashboards;

export const SearchResults: FC<Props> = ({
  results,
  onSelectionChanged,
  onTagSelected,
  onFolderExpanding,
  onToggleSelection,
  editable,
}) => {
  const toggleFolderExpand = (section: DashboardSection) => {
    if (section.toggle) {
      if (!section.expanded && typeof onFolderExpanding === 'function') {
        onFolderExpanding();
      }

      section.toggle(section).then(() => {
        if (typeof onSelectionChanged === 'function') {
          onSelectionChanged();
        }
      });
    }
  };

  return !results || !results.length ? (
    <div className="search-results">
      <em className="muted">No dashboards found.</em>
    </div>
  ) : (
    <>
      {results.map(section => (
        <div className="search-section" key={section.id}>
          {!section.hideHeader ? (
            <div
              className={cx('search-section__header pointer', { selected: section.checked })}
              onClick={() => toggleFolderExpand(section)}
            >
              <DashboardCheckbox
                editable={editable}
                checked={section.checked}
                onClick={(e: MouseEvent) => onToggleSelection(section, e)}
              />
              <Icon
                className={css`
                  padding: 5px 0;
                  width: 43px;
                `}
                name={section.icon as IconType}
              />

              <span className="search-section__header__text">{section.title}</span>
              {section.url && (
                <a href={section.url} className="search-section__header__link">
                  <Icon name="cog" />
                </a>
              )}
              <Icon name={section.expanded ? 'angle-down' : 'angle-right'} className="search-section__header__toggle" />
            </div>
          ) : (
            <div className="search-section__header" />
          )}
          {section.expanded &&
            section.items.map(item => (
              <ResultsItem key={item.id} {...{ item, editable, onToggleSelection, onTagSelected }} />
            ))}
        </div>
      ))}
    </>
  );
};

interface CheckboxProps {
  checked: boolean;
  onClick: any;
  editable?: boolean;
}
const DashboardCheckbox: FC<CheckboxProps> = ({ checked, onClick, editable = false }) => {
  return (
    editable && (
      <div
        onClick={onClick}
        className={cx(
          'center-vh',
          css`
            height: 19px;
            & > label {
              height: 100%;
            }
          `
        )}
      >
        <Forms.Checkbox value={checked} />
      </div>
    )
  );
};

interface ResultsItemProps {
  item: DashboardSectionItem;
  editable?: boolean;
  onToggleSelection: any;
  onTagSelected: any;
}

const getResultsItemStyles = (theme: GrafanaTheme, selected: boolean) => ({
  wrapper: cx(
    css`
      display: flex;
      align-items: center;
      margin: ${theme.spacing.xxs};
      padding: 0 ${theme.spacing.sm};
      background: ${stv(
        {
          light: theme.colors.white,
          dark: theme.colors.dark4,
        },
        theme.type
      )};
      box-shadow: -1px -1px 0 0 hsla(0, 0%, 100%, 0.1),
        1px 1px 0 0 ${stv({ light: 'rgba(0, 0, 0, 0.1)', dark: 'rgba(0, 0, 0, 0.3)' }, theme.type)};
      color: ${theme.colors.text};
      border-radius: ${theme.border.radius.md};
      min-height: 37px;
      &:hover,
      &.selected {
        background: ${stv(
          { dark: `linear-gradient(135deg, ${theme.colors.dark9}, ${theme.colors.dark6})`, light: theme.colors.gray6 },
          theme.type
        )};
      }
    `,
    'pointer',
    { selected }
  ),
  title: css`
    color: ${selected ? theme.colors.textStrong : theme.colors.text};
  `,
  body: css`
    display: flex;
    flex-direction: column;
    justify-content: center;
    flex: 1 1 auto;
    overflow: hidden;
    padding: 0 10px;
  `,
  folderTitle: css`
    color: ${theme.colors.textWeak};
    font-size: ${theme.typography.size.xs};
    line-height: ${theme.typography.lineHeight.xs};
    position: relative;
    top: -1px;
  `,
  icon: css`
    font-size: ${theme.typography.size.lg};
    width: auto;
    height: auto;
    padding: 1px 2px 0 10px;
  `,
});

const ResultsItem: FC<ResultsItemProps> = ({ item, editable, onToggleSelection, onTagSelected }) => {
  const theme = useTheme();
  const styles = getResultsItemStyles(theme, item.checked);

  const onItemClick = (item: DashboardSectionItem) => {
    //Check if one string can be found in the other
    if (window.location.pathname.includes(item.url) || item.url.includes(window.location.pathname)) {
      appEvents.emit(CoreEvents.hideDashSearch);
    }
  };

  const navigate = (item: DashboardSectionItem) => {
    window.location.pathname = item.url;
  };

  return (
    <div aria-label={selectors.dashboards(item.title)} className={styles.wrapper} onClick={() => navigate(item)}>
      <DashboardCheckbox
        editable={editable}
        checked={item.checked}
        onClick={(e: MouseEvent) => onToggleSelection(item, e)}
      />
      <Icon name="th-large" className={styles.icon} />
      <span className={styles.body} onClick={() => onItemClick(item)}>
        <div className={styles.title}>{item.title}</div>
        <span className={styles.folderTitle}>{item.folderTitle}</span>
      </span>
      <span className="search-item__tags">
        {item.tags.map(tag => (
          <span key={tag} onClick={() => onTagSelected(tag)} className="label label-tag">
            {tag}
          </span>
        ))}
      </span>
    </div>
  );
};
