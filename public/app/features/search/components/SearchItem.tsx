import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { e2e } from '@grafana/e2e';
import { Icon, useTheme, TagList } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { CoreEvents } from 'app/types';
import { DashboardSectionItem } from '../types';
import { SearchCheckbox } from './SearchCheckbox';

export interface Props {
  item: DashboardSectionItem;
  editable?: boolean;
  onToggleSelection: any;
  onTagSelected: any;
}

const { selectors } = e2e.pages.Dashboards;

export const SearchItem: FC<Props> = ({ item, editable, onToggleSelection, onTagSelected }) => {
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
    <li aria-label={selectors.dashboards(item.title)} className={styles.wrapper} onClick={() => navigate(item)}>
      <SearchCheckbox
        editable={editable}
        checked={item.checked}
        onClick={(e: MouseEvent) => onToggleSelection(item, e)}
      />
      <Icon className={styles.icon} name="th-large" />
      <span className={styles.body} onClick={() => onItemClick(item)}>
        <div className={styles.title}>{item.title}</div>
        <span className={styles.folderTitle}>{item.folderTitle}</span>
      </span>
      <TagList tags={item.tags} onClick={onTagSelected} className={styles.tags} />
    </li>
  );
};

const getResultsItemStyles = (theme: GrafanaTheme, selected: boolean) => ({
  wrapper: cx(
    css`
      display: flex;
      align-items: center;
      margin: ${theme.spacing.xxs};
      padding: 0 ${theme.spacing.sm};
      background: ${theme.isLight ? theme.colors.white : theme.colors.dark4};
      box-shadow: -1px -1px 0 0 hsla(0, 0%, 100%, 0.1),
        1px 1px 0 0 ${theme.isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.3)'};
      color: ${theme.colors.text};
      border-radius: ${theme.border.radius.md};
      min-height: 37px;
      &:hover,
      &.selected {
        background: ${theme.isLight
          ? theme.colors.gray6
          : `linear-gradient(135deg, ${theme.colors.dark9}, ${theme.colors.dark6})`};
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
  tags: css`
    justify-content: flex-end;
    @media only screen and (max-width: ${theme.breakpoints.md}) {
      display: none;
    }
  `,
});
