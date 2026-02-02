import { css } from '@emotion/css';
import { FC, memo, useState } from 'react';

import { GrafanaTheme } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { CallToActionCard, HorizontalGroup, Spinner, stylesFactory, useTheme, FilterInput } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { t } from 'app/core/internationalization';
import { contextSrv } from 'app/core/services/context_srv';

import { SearchLayout } from '../../types';
import { useManageFields } from '../hooks/useManageFields';
import { useSearchQuery } from '../hooks/useSearchQuery';

import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { ListActions } from './ListActions';
import { SearchResults } from './SearchResults';
import { SearchResultsFilter } from './SearchResultsFilter';

export interface Props {}

const { isEditor } = contextSrv;

export const ManageLists: FC<Props> = memo(({}) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const queryParams = {
    layout: false ? SearchLayout.List : SearchLayout.Module,
  };
  const {
    query,
    hasFilters,
    onQueryChange,
    onSortChange,
    onLayoutChange,
    onFilterTypeChange,
    onErrChange,
    onDSInstanceUrlChange,
  } = useSearchQuery(queryParams);

  const {
    results,
    loading,
    initialLoading,
    showActions,
    onToggleSection,
    onToggleChecked,
    onDeleteItems,
    onItemAction,
    noFolders,
    typeOptions,
  } = useManageFields(query, { onErrChange, onDSInstanceUrlChange });

  const onItemDelete = () => {
    setIsDeleteModalOpen(true);
  };

  if (initialLoading) {
    return <Spinner className={styles.spinner} />;
  }
  if (query.calcFieldErr) {
    return <CallToActionCard message={query.calcFieldErr} callToActionElement={<></>} />;
  }
  if (noFolders && !hasFilters) {
    return (
      <EmptyListCTA
        title={t('bmc.calc-fields.no-calc-fields', "You haven't created any calculated fields yet.")}
        buttonIcon="plus"
        buttonTitle={t('bmc.calc-fields.title', 'Calculated fields')}
        onClick={() => {
          locationService.push({ pathname: 'calculated-fields/new' });
        }}
      />
    );
  }

  const searchByName = t('bmc.calc-fields.search-by-name', 'Search calculated fields by name');
  const hasEditPermission = contextSrv.hasPermission('calculated.fields:create') || isEditor;
  return (
    <div className={styles.container}>
      <div>
        {
          //BMC Code : Accessibility Change (Next line, Added a label for FilterInput)
        }
        <label htmlFor="calculated-field-serach-filter-input" className={styles.hiddenLabel}>
          {searchByName}
        </label>
        <HorizontalGroup justify="space-between">
          {
            //BMC Code : Accessibility Change | Added id attribute to bind it to label element
          }
          <FilterInput
            id="calculated-field-serach-filter-input"
            width={40}
            value={query.query}
            onChange={onQueryChange}
            placeholder={searchByName}
          />
          <ListActions canEdit={hasEditPermission} />
        </HorizontalGroup>
      </div>

      <div className={styles.results}>
        <SearchResultsFilter
          showActions={showActions}
          deleteItem={onItemDelete}
          itemAction={onItemAction}
          onSortChange={onSortChange}
          query={query}
          hideLayout={!!false}
          onLayoutChange={onLayoutChange}
          editable={hasEditPermission}
          typeOptions={typeOptions}
          onFilterTypeChange={onFilterTypeChange}
        />
        <SearchResults
          loading={loading}
          results={results}
          editable={hasEditPermission}
          onToggleSection={onToggleSection}
          onToggleChecked={onToggleChecked}
          layout={query.layout}
          sort={query.sort}
          filterType={query.filterType}
          query={query.query}
        />
      </div>
      <ConfirmDeleteModal
        onDeleteItems={onDeleteItems}
        results={results}
        isOpen={isDeleteModalOpen}
        layout={query.layout}
        onDismiss={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
});
ManageLists.displayName = 'ManageLists';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      height: 100%;
    `,
    results: css`
      display: flex;
      flex-direction: column;
      flex: 1;
      height: 100%;
      padding-top: ${theme.spacing.xl};
    `,
    spinner: css`
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 200px;
    `,
    // BMC Code : Accessibility Change starts here.
    hiddenLabel: css`
      border: 0;
      clip: rect(0 0 0 0);
      height: 1px;
      margin: -1px;
      overflow: hidden;
      padding: 0;
      position: absolute;
      width: 1px;
    `,
    // BMC Code : Accessibility Change ends here.
  };
});
