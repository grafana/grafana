import { css } from '@emotion/css';
import { cloneDeep as _cloneDeep } from 'lodash';
import { FC, useCallback } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList } from 'react-window';

import { GrafanaTheme } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { stylesFactory, useTheme, Spinner } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { SEARCH_ITEM_HEIGHT, SEARCH_ITEM_MARGIN } from '../../constants';
import { CalcFieldModule, OnToggleChecked, SearchLayout, CalcFieldItem } from '../../types';
import { sortSectionResults, sortListResults, filterByType, filterByQuery } from '../../utils';

import { SearchItem } from './SearchItem';
import { SectionHeader } from './SectionHeader';

export interface Props {
  editable: boolean;
  loading?: boolean;
  onToggleChecked?: OnToggleChecked;
  onToggleSection: (section: CalcFieldModule) => void;
  results: CalcFieldModule[] | CalcFieldItem[];
  layout: SearchLayout.Module | SearchLayout.List;
  sort: any;
  filterType: string;
  query: string;
}

const { sectionV2: sectionLabel, itemsV2: itemsLabel } = selectors.components.Search;

export const SearchResults: FC<Props> = ({
  editable,
  loading,
  onToggleChecked,
  onToggleSection,
  results,
  layout,
  sort,
  filterType,
  query,
}) => {
  const theme = useTheme();
  const styles = getSectionStyles(theme);
  const itemProps = { editable, onToggleChecked };

  const noMatchFoundTemp = useCallback(() => {
    return (
      <>
        {/* BMC Code : Accessibility Change Next 3 line */}
        <div className="sr-only">
          <Trans i18nKey="bmc.calc-fields.not-found">No calculated fields matching your query were found.</Trans>
        </div>
        <div className={styles.noResults}>
          <Trans i18nKey="bmc.calc-fields.not-found">No calculated fields matching your query were found.</Trans>
        </div>
        {/* BMC Code : Accessibility Change Next line */}
      </>
    );
  }, [styles.noResults]);

  const renderFolders = () => {
    const filteredResults = filterByQuery(results, query, layout);
    sortSectionResults(filteredResults as CalcFieldModule[], sort);
    return (
      // BMC Code : Accessibility Change starts here
      <div role="status" aria-live="polite" aria-atomic="true">
        {
          filteredResults.length ? (
            <div className={styles.wrapper}>
              {(filteredResults as CalcFieldModule[]).map((section) => {
                return (
                  <div aria-label={sectionLabel} className={styles.section} key={section.id || section.title}>
                    <SectionHeader
                      onSectionClick={(section: CalcFieldModule) => {
                        return !query ? onToggleSection(section) : null;
                      }}
                      {...{ editable, section }}
                    />
                    {section.expanded && (
                      <div aria-label={itemsLabel} className={styles.sectionItems}>
                        {section.items.map((item) => (
                          <SearchItem key={item.fieldId || item.name} {...itemProps} item={item} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            noMatchFoundTemp()
          )
          // BMC Code : Accessibility Change ends here.
        }
      </div>
    );
  };

  const renderList = () => {
    let items: CalcFieldItem[] = filterByQuery(results, query, layout) as CalcFieldItem[];
    items = filterByType(items, filterType);
    sortListResults(items, sort);

    return items.length ? (
      <div className={styles.listModeWrapper}>
        <AutoSizer disableWidth>
          {({ height }) => (
            <FixedSizeList
              aria-label="Search items"
              className={styles.wrapper}
              innerElementType="ul"
              itemSize={SEARCH_ITEM_HEIGHT + SEARCH_ITEM_MARGIN}
              height={height}
              itemCount={items.length}
              width="100%"
            >
              {({ index, style }) => {
                const item = items[index];
                // The wrapper div is needed as the inner SearchItem has margin-bottom spacing
                // And without this wrapper there is no room for that margin
                return (
                  <div style={style}>
                    <SearchItem key={item.fieldId || item.name} {...itemProps} item={item} />
                  </div>
                );
              }}
            </FixedSizeList>
          )}
        </AutoSizer>
      </div>
    ) : (
      noMatchFoundTemp()
    );
  };

  if (loading) {
    return <Spinner className={styles.spinner} />;
  } else if (!results || !results.length) {
    return noMatchFoundTemp();
  }

  return (
    <div className={styles.resultsContainer}>{layout === SearchLayout.Module ? renderFolders() : renderList()}</div>
  );
};

const getSectionStyles = stylesFactory((theme: GrafanaTheme) => {
  const { md } = theme.spacing;

  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
    }),
    section: css({
      display: 'flex',
      flexDirection: 'column',
      background: theme.colors.panelBg,
      borderBottom: `solid 1px ${theme.colors.border2}`,
    }),
    sectionItems: css({
      margin: '0 24px 0 32px',
    }),
    spinner: css({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100px',
    }),
    resultsContainer: css({
      position: 'relative',
      flexGrow: 10,
      marginBottom: md,
      background: theme.colors.bg1,
      border: `1px solid ${theme.colors.border1}`,
      // eslint-disable-next-line @grafana/no-border-radius-literal
      borderRadius: '3px',
      height: '300px',
      overflow: 'auto',
    }),
    noResults: css({
      padding: md,
      background: theme.colors.bg2,
      fontStyle: 'italic',
      paddingTop: theme.spacing.md,
    }),
    listModeWrapper: css({
      position: 'relative',
      height: '100%',
      padding: md,
    }),
  };
});
