import { css } from '@emotion/css';
import React from 'react';
import { FixedSizeGrid } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { VisualizationSuggestionCard } from 'app/features/panel/components/VizTypePicker/VisualizationSuggestionCard';

import { useSearchKeyboardNavigation } from '../../hooks/useSearchKeyboardSelection';
import { DashboardQueryResult } from '../../service';

import { SearchResultsProps } from './SearchResultsTable';


export const PanelSearchGrid = ({
  response,
  width,
  height,
  selection,
  selectionToggle,
  onTagSelected,
  onClickItem,
  keyboardEvents,
}: SearchResultsProps) => {
  const styles = useStyles2(getStyles);

  const itemCount = response.totalRows ?? response.view.length;
  const view = response.view;
  const numColumns = Math.ceil(width / 600);
  const cellWidth = width / numColumns;
  const cellHeight = (cellWidth - 64) * 0.70 + 56 + 8;
  const numRows = Math.ceil(itemCount / numColumns);
  const highlightIndex = useSearchKeyboardNavigation(keyboardEvents, numColumns, response);

  const renderItem = (item: DashboardQueryResult) => {
    const kind = item.kind ?? 'dashboard';
    let className = styles.virtualizedGridItemWrapper;
    if (rowIndex === highlightIndex.y && columnIndex === highlightIndex.x) {
      className += ' ' + styles.selectedItem;
    }

    // The wrapper div is needed as the inner SearchItem has margin-bottom spacing
    // And without this wrapper there is no room for that margin
    return (
      <div style={style} className={className}>
        <div>
          {kind === 'panel' ? <VisualizationSuggestionCard
          key={index}
          data={data!}
          suggestion={suggestion}
          onChange={onChange}
          width={previewWidth}
        /> ? <div>{JSON.stringify(item)}</div> }
        </div>
      </div>
    );
  }

  return (
    <InfiniteLoader isItemLoaded={response.isItemLoaded} itemCount={itemCount} loadMoreItems={response.loadMoreItems}>
      {({ onItemsRendered, ref }) => (
        <FixedSizeGrid
          ref={ref}
          onItemsRendered={(v) => {
            onItemsRendered({
              visibleStartIndex: v.visibleRowStartIndex * numColumns,
              visibleStopIndex: v.visibleRowStopIndex * numColumns,
              overscanStartIndex: v.overscanRowStartIndex * numColumns,
              overscanStopIndex: v.overscanColumnStopIndex * numColumns,
            });
          }}
          columnCount={numColumns}
          columnWidth={cellWidth}
          rowCount={numRows}
          rowHeight={cellHeight}
          className={styles.wrapper}
          innerElementType="ul"
          height={height}
          width={width - 2}
        >
          {({ columnIndex, rowIndex, style }) => {
            const index = rowIndex * numColumns + columnIndex;
            if (index >= view.length) {
              return null;
            }
            const item = view.get(index);
            if(!item) {
              return null; // ???
            }

            return renderItem(item);
          }}
        </FixedSizeGrid>
      )}
    </InfiniteLoader>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
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
  selectedItem: css`
    box-shadow: inset 1px 1px 3px 3px ${theme.colors.primary.border};
  `,
});
