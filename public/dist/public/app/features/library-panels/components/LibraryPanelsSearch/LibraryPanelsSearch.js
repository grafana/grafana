import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';
import { useDebounce } from 'react-use';
import { useStyles2, VerticalGroup, FilterInput } from '@grafana/ui';
import { FolderFilter } from '../../../../core/components/FolderFilter/FolderFilter';
import { PanelTypeFilter } from '../../../../core/components/PanelTypeFilter/PanelTypeFilter';
import { SortPicker } from '../../../../core/components/Select/SortPicker';
import { DEFAULT_PER_PAGE_PAGINATION } from '../../../../core/constants';
import { LibraryPanelsView } from '../LibraryPanelsView/LibraryPanelsView';
export var LibraryPanelsSearchVariant;
(function (LibraryPanelsSearchVariant) {
    LibraryPanelsSearchVariant["Tight"] = "tight";
    LibraryPanelsSearchVariant["Spacious"] = "spacious";
})(LibraryPanelsSearchVariant || (LibraryPanelsSearchVariant = {}));
export const LibraryPanelsSearch = ({ onClick, variant = LibraryPanelsSearchVariant.Spacious, currentPanelId, currentFolderUID, perPage = DEFAULT_PER_PAGE_PAGINATION, showPanelFilter = false, showFolderFilter = false, showSort = false, showSecondaryActions = false, }) => {
    const styles = useStyles2(getStyles, variant);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
    useDebounce(() => setDebouncedSearchQuery(searchQuery), 200, [searchQuery]);
    const [sortDirection, setSortDirection] = useState({});
    const [folderFilter, setFolderFilter] = useState(currentFolderUID ? [currentFolderUID] : []);
    const [panelFilter, setPanelFilter] = useState([]);
    const sortOrFiltersVisible = showSort || showPanelFilter || showFolderFilter;
    const verticalGroupSpacing = variant === LibraryPanelsSearchVariant.Tight ? 'lg' : 'xs';
    return (React.createElement("div", { className: styles.container },
        React.createElement(VerticalGroup, { spacing: verticalGroupSpacing },
            React.createElement("div", { className: styles.gridContainer },
                React.createElement("div", { className: styles.filterInputWrapper },
                    React.createElement(FilterInput, { value: searchQuery, onChange: setSearchQuery, placeholder: "Search by name or description", width: 0, escapeRegex: false })),
                sortOrFiltersVisible && (React.createElement(SearchControls, { showSort: showSort, showPanelFilter: showPanelFilter, showFolderFilter: showFolderFilter, onSortChange: setSortDirection, onFolderFilterChange: setFolderFilter, onPanelFilterChange: setPanelFilter, sortDirection: sortDirection.value, variant: variant }))),
            React.createElement("div", { className: styles.libraryPanelsView },
                React.createElement(LibraryPanelsView, { onClickCard: onClick, searchString: debouncedSearchQuery, sortDirection: sortDirection.value, panelFilter: panelFilter, folderFilter: folderFilter, currentPanelId: currentPanelId, showSecondaryActions: showSecondaryActions, perPage: perPage })))));
};
function getStyles(theme, variant) {
    const tightLayout = css `
    flex-direction: row;
    row-gap: ${theme.spacing(1)};
  `;
    return {
        filterInputWrapper: css `
      flex-grow: ${variant === LibraryPanelsSearchVariant.Tight ? 1 : 'initial'};
    `,
        container: css `
      width: 100%;
      overflow-y: auto;
      padding: ${theme.spacing(1)};
    `,
        libraryPanelsView: css `
      width: 100%;
    `,
        gridContainer: css `
      ${variant === LibraryPanelsSearchVariant.Tight ? tightLayout : ''};
      display: flex;
      flex-direction: column;
      width: 100%;
      column-gap: ${theme.spacing(1)};
      row-gap: ${theme.spacing(1)};
      padding-bottom: ${theme.spacing(2)};
    `,
    };
}
const SearchControls = React.memo(({ variant = LibraryPanelsSearchVariant.Spacious, showSort, showPanelFilter, showFolderFilter, sortDirection, onSortChange, onFolderFilterChange, onPanelFilterChange, }) => {
    const styles = useStyles2(getRowStyles, variant);
    const panelFilterChanged = useCallback((plugins) => onPanelFilterChange(plugins.map((p) => p.id)), [onPanelFilterChange]);
    const folderFilterChanged = useCallback((folders) => onFolderFilterChange(folders.map((f) => { var _a; return (_a = f.uid) !== null && _a !== void 0 ? _a : ''; })), [onFolderFilterChange]);
    return (React.createElement("div", { className: styles.container },
        showSort && React.createElement(SortPicker, { value: sortDirection, onChange: onSortChange, filter: ['alpha-asc', 'alpha-desc'] }),
        (showFolderFilter || showPanelFilter) && (React.createElement("div", { className: styles.filterContainer },
            showFolderFilter && React.createElement(FolderFilter, { onChange: folderFilterChanged }),
            showPanelFilter && React.createElement(PanelTypeFilter, { onChange: panelFilterChanged })))));
});
SearchControls.displayName = 'SearchControls';
function getRowStyles(theme, variant = LibraryPanelsSearchVariant.Spacious) {
    const searchRowContainer = css `
    display: flex;
    gap: ${theme.spacing(1)};
    flex-grow: 1;
    flex-direction: row;
    justify-content: end;
  `;
    const searchRowContainerTight = css `
    ${searchRowContainer};
    flex-grow: initial;
    flex-direction: column;
    justify-content: normal;
  `;
    const filterContainer = css `
    display: flex;
    flex-direction: row;
    margin-left: auto;
    gap: 4px;
  `;
    const filterContainerTight = css `
    ${filterContainer};
    flex-direction: column;
    margin-left: initial;
  `;
    switch (variant) {
        case LibraryPanelsSearchVariant.Spacious:
            return {
                container: searchRowContainer,
                filterContainer: filterContainer,
            };
        case LibraryPanelsSearchVariant.Tight:
            return {
                container: searchRowContainerTight,
                filterContainer: filterContainerTight,
            };
    }
}
//# sourceMappingURL=LibraryPanelsSearch.js.map