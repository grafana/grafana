import React, { FC, MutableRefObject } from 'react';
import { css } from 'emotion';
import { FixedSizeList } from 'react-window';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, useTheme, Spinner } from '@grafana/ui';
import { DashboardSection, OnToggleChecked, SearchLayout } from '../types';
import { getItemsHeight, getVisibleItems } from '../utils';
import { ITEM_HEIGHT } from '../constants';
import { useListHeight } from '../hooks/useListHeight';
import { SearchItem } from './SearchItem';
import { SectionHeader } from './SectionHeader';

export interface Props {
  editable?: boolean;
  loading?: boolean;
  onTagSelected: (name: string) => any;
  onToggleChecked?: OnToggleChecked;
  onToggleSection: (section: DashboardSection) => void;
  results: DashboardSection[] | undefined;
  layout?: string;
  wrapperRef?: MutableRefObject<HTMLDivElement | null>;
}

export const SearchResults: FC<Props> = ({
  editable,
  loading,
  onTagSelected,
  onToggleChecked,
  onToggleSection,
  results,
  wrapperRef,
  layout,
}) => {
  const theme = useTheme();
  const styles = getSectionStyles(theme);
  const listHeight = useListHeight(wrapperRef?.current?.offsetTop);
  const itemProps = { editable, onToggleChecked, onTagSelected };

  const renderFolders = () => {
    return (
      <ul className={styles.wrapper}>
        {results.map(section => {
          return (
            <li aria-label="Search section" className={styles.section} key={section.title}>
              <SectionHeader onSectionClick={onToggleSection} {...{ onToggleChecked, editable, section }} />
              <ul aria-label="Search items">
                {section.expanded && section.items.map(item => <SearchItem key={item.id} {...itemProps} item={item} />)}
              </ul>
            </li>
          );
        })}
      </ul>
    );
  };

  const items = getVisibleItems(results);
  const count = items.length;
  const height = getItemsHeight(count, listHeight);

  const renderDashboards = () => {
    return (
      <FixedSizeList
        aria-label="Search items"
        className={styles.wrapper}
        innerElementType="ul"
        itemSize={ITEM_HEIGHT}
        height={height}
        itemCount={items.length}
        width="100%"
      >
        {({ index, style }) => {
          const item = items[index];
          return <SearchItem key={item.id} {...itemProps} item={item} style={style} />;
        }}
      </FixedSizeList>
    );
  };

  if (loading) {
    return <Spinner className={styles.spinner} />;
  } else if (!results || !results.length) {
    return <h6>No dashboards matching your query were found.</h6>;
  }
  return (
    <div className="search-results-container">
      {layout !== SearchLayout.List ? renderFolders() : renderDashboards()}
    </div>
  );
};

const getSectionStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    wrapper: css`
      list-style: none;
    `,
    section: css`
      background: ${theme.colors.panelBg};
      border-bottom: solid 1px ${theme.isLight ? theme.palette.gray95 : theme.palette.gray25};
      padding: 0px 4px 4px 4px;
      margin-bottom: 3px;
    `,
    spinner: css`
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100px;
    `,
  };
});
