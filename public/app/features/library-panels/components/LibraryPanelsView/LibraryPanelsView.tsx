import { css } from '@emotion/css';
import React, { useMemo, useReducer } from 'react';
import { useDebounce } from 'react-use';

import { GrafanaTheme2, LoadingState } from '@grafana/data';
import { Pagination, Stack, useStyles2 } from '@grafana/ui';

import { LibraryElementDTO } from '../../types';
import { LibraryPanelCard } from '../LibraryPanelCard/LibraryPanelCard';

import { asyncDispatcher, deleteLibraryPanel, searchForLibraryPanels } from './actions';
import { changePage, initialLibraryPanelsViewState, libraryPanelsViewReducer } from './reducer';

interface LibraryPanelViewProps {
  onClickCard: (panel: LibraryElementDTO) => void;
  showSecondaryActions?: boolean;
  currentPanelId?: string;
  searchString: string;
  sortDirection?: string;
  panelFilter?: string[];
  folderFilter?: string[];
  perPage?: number;
  isWidget?: boolean;
}

export const LibraryPanelsView = ({
  onClickCard,
  searchString,
  sortDirection,
  panelFilter,
  folderFilter,
  showSecondaryActions,
  currentPanelId: currentPanel,
  perPage: propsPerPage = 40,
  isWidget,
}: LibraryPanelViewProps) => {
  const styles = useStyles2(getPanelViewStyles);
  const [{ libraryPanels, page, perPage, numberOfPages, loadingState, currentPanelId }, dispatch] = useReducer(
    libraryPanelsViewReducer,
    {
      ...initialLibraryPanelsViewState,
      currentPanelId: currentPanel,
      perPage: propsPerPage,
    }
  );
  const asyncDispatch = useMemo(() => asyncDispatcher(dispatch), [dispatch]);
  useDebounce(
    () =>
      asyncDispatch(
        searchForLibraryPanels({
          searchString,
          sortDirection,
          panelFilter,
          folderFilterUIDs: folderFilter,
          page,
          perPage,
          currentPanelId,
          isWidget,
        })
      ),
    300,
    [searchString, sortDirection, panelFilter, folderFilter, page, asyncDispatch]
  );
  const onDelete = ({ uid }: LibraryElementDTO) =>
    asyncDispatch(
      deleteLibraryPanel(uid, {
        searchString,
        sortDirection,
        panelFilter,
        folderFilterUIDs: folderFilter,
        page,
        perPage,
      })
    );
  const onPageChange = (page: number) => asyncDispatch(changePage({ page }));

  return (
    <Stack direction="column" wrap="nowrap">
      {loadingState === LoadingState.Loading ? (
        <>
          <LibraryPanelCard.Skeleton showSecondaryActions={showSecondaryActions} />
          <LibraryPanelCard.Skeleton showSecondaryActions={showSecondaryActions} />
          <LibraryPanelCard.Skeleton showSecondaryActions={showSecondaryActions} />
        </>
      ) : libraryPanels.length < 1 ? (
        <p className={styles.noPanelsFound}>No library panels found.</p>
      ) : (
        libraryPanels?.map((item, i) => (
          <LibraryPanelCard
            key={`library-panel=${i}`}
            libraryPanel={item}
            onDelete={onDelete}
            onClick={onClickCard}
            showSecondaryActions={showSecondaryActions}
          />
        ))
      )}
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
    </Stack>
  );
};

const getPanelViewStyles = (theme: GrafanaTheme2) => {
  return {
    pagination: css({
      alignSelf: 'center',
      marginTop: theme.spacing(1),
    }),
    noPanelsFound: css({
      label: 'noPanelsFound',
      minHeight: 200,
    }),
  };
};
