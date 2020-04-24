import React, { FC, MutableRefObject } from 'react';
import { css, cx } from 'emotion';
import { FixedSizeList } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, useTheme, Spinner } from '@grafana/ui';
import { DashboardSection, OnToggleChecked, SearchLayout } from '../types';
import { getVisibleItems } from '../utils';
import { ITEM_HEIGHT } from '../constants';
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

  const renderDashboards = () => {
    return (
      <AutoSizer disableWidth>
        {({ height }) => (
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
        )}
      </AutoSizer>
    );
  };

  if (loading) {
    return <Spinner className={styles.spinner} />;
  } else if (!results || !results.length) {
    return <h6>No dashboards matching your query were found.</h6>;
  }
  return (
    <div className={cx('results-container', styles.resultsContainer)}>
      {layout !== SearchLayout.List ? renderFolders() : renderDashboards()}
    </div>
  );
};

const getSectionStyles = stylesFactory((theme: GrafanaTheme) => {
  const { xs, sm, md } = theme.spacing;
  return {
    wrapper: css`
      list-style: none;
    `,
    section: css`
      background: ${theme.colors.panelBg};
      border-bottom: solid 1px ${theme.isLight ? theme.palette.gray95 : theme.palette.gray25};
      padding: 0px ${xs} ${xs};
      margin-bottom: 3px;
    `,
    spinner: css`
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100px;
    `,
    resultsContainer: css`
      padding: ${sm};
      position: relative;
      flex-grow: 10;
      margin-bottom: ${md};
      background: ${theme.palette.gray10};
      border: 1px solid ${theme.palette.gray15};
      border-radius: 3px;
      height: 100%;
    `,
  };
});
