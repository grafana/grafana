import React, { useMemo, useReducer } from 'react';
import { useDebounce } from 'react-use';
import { css, cx } from 'emotion';
import { Pagination, stylesFactory, useStyles } from '@grafana/ui';
import { GrafanaTheme, LoadingState } from '@grafana/data';

import { LibraryPanelCard } from '../LibraryPanelCard/LibraryPanelCard';
import { LibraryPanelDTO } from '../../types';
import { changePage, initialLibraryPanelsViewState, libraryPanelsViewReducer } from './reducer';
import { asyncDispatcher, deleteLibraryPanel, searchForLibraryPanels } from './actions';

interface LibraryPanelViewProps {
  className?: string;
  onClickCard: (panel: LibraryPanelDTO) => void;
  showSecondaryActions?: boolean;
  currentPanelId?: string;
  searchString: string;
}

export const LibraryPanelsView: React.FC<LibraryPanelViewProps> = ({
  className,
  onClickCard,
  searchString,
  showSecondaryActions,
  currentPanelId: currentPanel,
}) => {
  const styles = useStyles(getPanelViewStyles);
  const [{ libraryPanels, page, perPage, numberOfPages, loadingState, currentPanelId }, dispatch] = useReducer(
    libraryPanelsViewReducer,
    {
      ...initialLibraryPanelsViewState,
      currentPanelId: currentPanel,
    }
  );
  const asyncDispatch = useMemo(() => asyncDispatcher(dispatch), [dispatch]);
  useDebounce(() => asyncDispatch(searchForLibraryPanels({ searchString, page, perPage, currentPanelId })), 300, [
    searchString,
    page,
    asyncDispatch,
  ]);
  const onDelete = ({ uid }: LibraryPanelDTO) =>
    asyncDispatch(deleteLibraryPanel(uid, { searchString, page, perPage }));
  const onPageChange = (page: number) => asyncDispatch(changePage({ page }));

  return (
    <div className={cx(styles.container, className)}>
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
              showSecondaryActions={showSecondaryActions}
            />
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
    </div>
  );
};

const getPanelViewStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      display: flex;
      flex-direction: column;
      flex-wrap: nowrap;
    `,
    libraryPanelList: css`
      max-width: 100%;
      display: grid;
      grid-gap: ${theme.spacing.sm};
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
