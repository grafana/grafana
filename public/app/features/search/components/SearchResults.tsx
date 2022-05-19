import { css, cx } from '@emotion/css';
import React, { FC, memo } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList, FixedSizeGrid } from 'react-window';

import { GrafanaTheme } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Spinner, stylesFactory, useTheme } from '@grafana/ui';

import { SEARCH_ITEM_HEIGHT, SEARCH_ITEM_MARGIN } from '../constants';
import { DashboardSection, OnToggleChecked, SearchLayout } from '../types';

import { SearchCard } from './SearchCard';
import { SearchItem } from './SearchItem';
import { SectionHeader } from './SectionHeader';

export interface Props {
  editable?: boolean;
  loading?: boolean;
  onTagSelected: (name: string) => any;
  onToggleChecked?: OnToggleChecked;
  onToggleSection: (section: DashboardSection) => void;
  results: DashboardSection[];
  showPreviews?: boolean;
  layout?: string;
}

const { sectionV2: sectionLabel, itemsV2: itemsLabel, cards: cardsLabel } = selectors.components.Search;

export const SearchResults: FC<Props> = memo(
  ({ editable, loading, onTagSelected, onToggleChecked, onToggleSection, results, showPreviews, layout }) => {
    const theme = useTheme();
    const styles = getSectionStyles(theme);
    const itemProps = { editable, onToggleChecked, onTagSelected };
    const renderFolders = () => {
      const Wrapper = showPreviews ? SearchCard : SearchItem;
      return (
        <div className={styles.wrapper}>
          {results.map((section) => {
            return (
              <div data-testid={sectionLabel} className={styles.section} key={section.id || section.title}>
                {section.title && (
                  <SectionHeader onSectionClick={onToggleSection} {...{ onToggleChecked, editable, section }}>
                    <div
                      data-testid={showPreviews ? cardsLabel : itemsLabel}
                      className={cx(styles.sectionItems, { [styles.gridContainer]: showPreviews })}
                    >
                      {section.items.map((item) => (
                        <Wrapper {...itemProps} key={item.uid} item={item} />
                      ))}
                    </div>
                  </SectionHeader>
                )}
              </div>
            );
          })}
        </div>
      );
    };
    const renderDashboards = () => {
      const items = results[0]?.items;
      return (
        <div className={styles.listModeWrapper}>
          <AutoSizer>
            {({ height, width }) => {
              const numColumns = Math.ceil(width / 320);
              const cellWidth = width / numColumns;
              const cellHeight = (cellWidth - 64) * 0.75 + 56 + 8;
              const numRows = Math.ceil(items.length / numColumns);
              return showPreviews ? (
                <FixedSizeGrid
                  columnCount={numColumns}
                  columnWidth={cellWidth}
                  rowCount={numRows}
                  rowHeight={cellHeight}
                  className={styles.wrapper}
                  innerElementType="ul"
                  height={height}
                  width={width}
                >
                  {({ columnIndex, rowIndex, style }) => {
                    const index = rowIndex * numColumns + columnIndex;
                    const item = items[index];
                    // The wrapper div is needed as the inner SearchItem has margin-bottom spacing
                    // And without this wrapper there is no room for that margin
                    return item ? (
                      <li style={style} className={styles.virtualizedGridItemWrapper}>
                        <SearchCard key={item.id} {...itemProps} item={item} />
                      </li>
                    ) : null;
                  }}
                </FixedSizeGrid>
              ) : (
                <FixedSizeList
                  className={styles.wrapper}
                  innerElementType="ul"
                  itemSize={SEARCH_ITEM_HEIGHT + SEARCH_ITEM_MARGIN}
                  height={height}
                  itemCount={items.length}
                  width={width}
                >
                  {({ index, style }) => {
                    const item = items[index];
                    // The wrapper div is needed as the inner SearchItem has margin-bottom spacing
                    // And without this wrapper there is no room for that margin
                    return (
                      <li style={style}>
                        <SearchItem key={item.id} {...itemProps} item={item} />
                      </li>
                    );
                  }}
                </FixedSizeList>
              );
            }}
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
      <div className={styles.resultsContainer}>
        {layout === SearchLayout.Folders ? renderFolders() : renderDashboards()}
      </div>
    );
  }
);

SearchResults.displayName = 'SearchResults';

const getSectionStyles = stylesFactory((theme: GrafanaTheme) => {
  const { md, sm } = theme.spacing;

  return {
    virtualizedGridItemWrapper: css`
      padding: 4px;
    `,
    wrapper: css`
      display: flex;
      flex-direction: column;

      > ul {
        list-style: none;
      }
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
    gridContainer: css`
      display: grid;
      gap: ${sm};
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      margin-bottom: ${md};
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
      font-style: italic;
      margin-top: ${theme.spacing.md};
    `,
    listModeWrapper: css`
      position: relative;
      height: 100%;
      padding: ${md};
    `,
  };
});
