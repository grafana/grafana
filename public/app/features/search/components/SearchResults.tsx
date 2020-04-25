import React, { FC } from 'react';
import { css } from 'emotion';
import { FixedSizeList } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, useTheme, Spinner } from '@grafana/ui';
import { DashboardSection, OnToggleChecked, SearchLayout } from '../types';
import { getVisibleItems } from '../utils';
import { SEARCH_ITEM_HEIGHT } from '../constants';
import { SearchItem } from './SearchItem';
import { SectionHeader } from './SectionHeader';

export interface Props {
  editable?: boolean;
  loading?: boolean;
  onTagSelected: (name: string) => any;
  onToggleChecked?: OnToggleChecked;
  onToggleSection: (section: DashboardSection) => void;
  results: DashboardSection[];
  layout?: string;
}

export const SearchResults: FC<Props> = ({
  editable,
  loading,
  onTagSelected,
  onToggleChecked,
  onToggleSection,
  results,
  layout,
}) => {
  const theme = useTheme();
  const styles = getSectionStyles(theme);
  const itemProps = { editable, onToggleChecked, onTagSelected };

  const renderFolders = () => {
    return (
      <div className={styles.wrapper}>
        {results.map(section => {
          return (
            <div aria-label="Search section" className={styles.section} key={section.title}>
              <SectionHeader onSectionClick={onToggleSection} {...{ onToggleChecked, editable, section }} />
              <div aria-label="Search items" className={styles.sectionItems}>
                {section.expanded && section.items.map(item => <SearchItem key={item.id} {...itemProps} item={item} />)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const items = getVisibleItems(results);

  const renderDashboards = () => {
    return (
      <div className={styles.listModeWrapper}>
        <AutoSizer disableWidth>
          {({ height }) => (
            <FixedSizeList
              aria-label="Search items"
              className={styles.wrapper}
              innerElementType="ul"
              itemSize={SEARCH_ITEM_HEIGHT}
              height={height}
              itemCount={items.length}
              width="100%"
            >
              {({ index, style }) => {
                const item = items[index];
                return <SearchItem key={item.id} {...itemProps} item={item} style={style} />;
              }}
            </FixedSizeList>
          )}
        </AutoSizer>
      </div>
    );
  };

  if (loading) {
    return <Spinner className={styles.spinner} />;
  } else if (!results || !results.length) {
    return <div className={styles.noResults}>No dashboards matching your query were found.</div>;
  }

  return (
    <div className={styles.resultsContainer}>{layout !== SearchLayout.List ? renderFolders() : renderDashboards()}</div>
  );
};

const getSectionStyles = stylesFactory((theme: GrafanaTheme) => {
  const { md } = theme.spacing;

  return {
    wrapper: css`
      display: flex;
      flex-direction: column;
    `,
    section: css`
      display: flex;
      flex-direction: column;
      background: ${theme.colors.panelBg};
      border-bottom: solid 1px ${theme.colors.border2};
    `,
    sectionItems: css`
      margin: 0 24px 0 32px;
    `,
    spinner: css`
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100px;
    `,
    resultsContainer: css`
      position: relative;
      flex-grow: 10;
      margin-bottom: ${md};
      background: ${theme.colors.bg1};
      border: 1px solid ${theme.colors.border1};
      border-radius: 3px;
      height: 100%;
    `,
    noResults: css`
      padding: ${md};
      background: ${theme.colors.bg2};
      text-style: italic;
    `,
    listModeWrapper: css`
      position: relative;
      height: 100%;
      padding: ${md};
    `,
  };
});
