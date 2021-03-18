import React, { FormEvent, useMemo, useReducer } from 'react';
import { useDebounce } from 'react-use';
import { css, cx } from 'emotion';
import { Button, Icon, Input, Pagination, stylesFactory, useStyles } from '@grafana/ui';
import { DateTimeInput, GrafanaTheme, LoadingState } from '@grafana/data';

import { LibraryPanelCard } from '../LibraryPanelCard/LibraryPanelCard';
import { LibraryPanelDTO } from '../../types';
import { changePage, changeSearchString, initialLibraryPanelsViewState, libraryPanelsViewReducer } from './reducer';
import { asyncDispatcher, deleteLibraryPanel, searchForLibraryPanels } from './actions';

interface LibraryPanelViewProps {
  className?: string;
  onCreateNewPanel?: () => void;
  children?: (panel: LibraryPanelDTO, i: number) => JSX.Element | JSX.Element[];
  onClickCard?: (panel: LibraryPanelDTO) => void;
  formatDate?: (dateString: DateTimeInput, format?: string) => string;
  showSecondaryActions?: boolean;
  currentPanelId?: string;
}

export const LibraryPanelsView: React.FC<LibraryPanelViewProps> = ({
  children,
  className,
  onCreateNewPanel,
  onClickCard,
  formatDate,
  showSecondaryActions,
  currentPanelId: currentPanel,
}) => {
  const styles = useStyles(getPanelViewStyles);
  const [
    { libraryPanels, searchString, page, perPage, numberOfPages, loadingState, currentPanelId },
    dispatch,
  ] = useReducer(libraryPanelsViewReducer, {
    ...initialLibraryPanelsViewState,
    currentPanelId: currentPanel,
  });
  const asyncDispatch = useMemo(() => asyncDispatcher(dispatch), [dispatch]);
  useDebounce(() => asyncDispatch(searchForLibraryPanels({ searchString, page, perPage, currentPanelId })), 300, [
    searchString,
    page,
    asyncDispatch,
  ]);
  const onSearchChange = (event: FormEvent<HTMLInputElement>) =>
    asyncDispatch(changeSearchString({ searchString: event.currentTarget.value }));
  const onDelete = ({ uid }: LibraryPanelDTO) =>
    asyncDispatch(deleteLibraryPanel(uid, { searchString, page, perPage }));
  const onPageChange = (page: number) => asyncDispatch(changePage({ page }));

  return (
    <div className={cx(styles.container, className)}>
      <div className={styles.searchHeader}>
        <Input
          placeholder="Search the panel library"
          prefix={<Icon name="search" />}
          value={searchString}
          autoFocus
          onChange={onSearchChange}
        />
        {/* <Select placeholder="Filter by" onChange={() => {}} width={35} /> */}
      </div>
      <div className={styles.libraryPanelList}>
        {loadingState === LoadingState.Loading ? (
          <p>Loading library panels...</p>
        ) : libraryPanels.length < 1 ? (
          <p>No library panels found.</p>
        ) : (
          libraryPanels?.map((item, i) => (
            <LibraryPanelCard
              key={`shared-panel=${i}`}
              libraryPanel={item}
              onDelete={onDelete}
              onClick={onClickCard}
              formatDate={formatDate}
              showSecondaryActions={showSecondaryActions}
            >
              {children?.(item, i)}
            </LibraryPanelCard>
          ))
        )}
      </div>
      {libraryPanels.length ? (
        <div className={styles.pagination}>
          <Pagination
            currentPage={page}
            numberOfPages={numberOfPages}
            onNavigate={onPageChange}
            hideWhenSinglePage={true}
          />
        </div>
      ) : null}

      {onCreateNewPanel && (
        <Button icon="plus" className={styles.newPanelButton} onClick={onCreateNewPanel}>
          Create a new reusable panel
        </Button>
      )}
    </div>
  );
};

const getPanelViewStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      display: flex;
      flex-direction: column;
      flex-wrap: nowrap;
      gap: ${theme.spacing.sm};
      height: 100%;
      overflow-y: auto;
    `,
    libraryPanelList: css`
      display: flex;
      overflow-x: auto;
      flex-direction: column;
    `,
    searchHeader: css`
      display: flex;
    `,
    newPanelButton: css`
      margin-top: 10px;
      align-self: flex-start;
    `,
    pagination: css`
      align-self: center;
    `,
  };
});
