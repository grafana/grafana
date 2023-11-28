import { css, cx } from '@emotion/css';
import React, { useMemo, useReducer } from 'react';
import { useDebounce } from 'react-use';
import { LoadingState } from '@grafana/data';
import { Pagination, useStyles2 } from '@grafana/ui';
import { LibraryPanelCard } from '../LibraryPanelCard/LibraryPanelCard';
import { asyncDispatcher, deleteLibraryPanel, searchForLibraryPanels } from './actions';
import { changePage, initialLibraryPanelsViewState, libraryPanelsViewReducer } from './reducer';
export const LibraryPanelsView = ({ className, onClickCard, searchString, sortDirection, panelFilter, folderFilter, showSecondaryActions, currentPanelId: currentPanel, perPage: propsPerPage = 40, isWidget, }) => {
    const styles = useStyles2(getPanelViewStyles);
    const [{ libraryPanels, page, perPage, numberOfPages, loadingState, currentPanelId }, dispatch] = useReducer(libraryPanelsViewReducer, Object.assign(Object.assign({}, initialLibraryPanelsViewState), { currentPanelId: currentPanel, perPage: propsPerPage }));
    const asyncDispatch = useMemo(() => asyncDispatcher(dispatch), [dispatch]);
    useDebounce(() => asyncDispatch(searchForLibraryPanels({
        searchString,
        sortDirection,
        panelFilter,
        folderFilterUIDs: folderFilter,
        page,
        perPage,
        currentPanelId,
        isWidget,
    })), 300, [searchString, sortDirection, panelFilter, folderFilter, page, asyncDispatch]);
    const onDelete = ({ uid }) => asyncDispatch(deleteLibraryPanel(uid, {
        searchString,
        sortDirection,
        panelFilter,
        folderFilterUIDs: folderFilter,
        page,
        perPage,
    }));
    const onPageChange = (page) => asyncDispatch(changePage({ page }));
    return (React.createElement("div", { className: cx(styles.container, className) },
        React.createElement("div", { className: styles.libraryPanelList }, loadingState === LoadingState.Loading ? (React.createElement("p", null, "Loading library panels...")) : libraryPanels.length < 1 ? (React.createElement("p", { className: styles.noPanelsFound }, "No library panels found.")) : (libraryPanels === null || libraryPanels === void 0 ? void 0 : libraryPanels.map((item, i) => (React.createElement(LibraryPanelCard, { key: `library-panel=${i}`, libraryPanel: item, onDelete: onDelete, onClick: onClickCard, showSecondaryActions: showSecondaryActions }))))),
        libraryPanels.length ? (React.createElement("div", { className: styles.pagination },
            React.createElement(Pagination, { currentPage: page, numberOfPages: numberOfPages, onNavigate: onPageChange, hideWhenSinglePage: true }))) : null));
};
const getPanelViewStyles = (theme) => {
    return {
        container: css `
      display: flex;
      flex-direction: column;
      flex-wrap: nowrap;
    `,
        libraryPanelList: css `
      max-width: 100%;
      display: grid;
      grid-gap: ${theme.spacing(1)};
    `,
        searchHeader: css `
      display: flex;
    `,
        newPanelButton: css `
      margin-top: 10px;
      align-self: flex-start;
    `,
        pagination: css `
      align-self: center;
      margin-top: ${theme.spacing(1)};
    `,
        noPanelsFound: css `
      label: noPanelsFound;
      min-height: 200px;
    `,
    };
};
//# sourceMappingURL=LibraryPanelsView.js.map