import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useId, useState } from 'react';
import { useAsync } from 'react-use';
import { toIconName } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Card, Checkbox, CollapsableSection, Icon, Spinner, useStyles2 } from '@grafana/ui';
import { config } from 'app/core/config';
import { t } from 'app/core/internationalization';
import { SearchItem } from '../..';
import { GENERAL_FOLDER_UID, SEARCH_EXPANDED_FOLDER_STORAGE_KEY } from '../../constants';
import { getGrafanaSearcher } from '../../service';
import { getFolderChildren } from '../../service/folders';
import { queryResultToViewItem } from '../../service/utils';
function getChildren(section, tags) {
    return __awaiter(this, void 0, void 0, function* () {
        if (config.featureToggles.nestedFolders) {
            return getFolderChildren(section.uid, section.title);
        }
        const query = section.itemsUIDs
            ? {
                uid: section.itemsUIDs,
            }
            : {
                query: '*',
                kind: ['dashboard'],
                location: section.uid,
                sort: 'name_sort',
                limit: 1000, // this component does not have infinite scroll, so we need to load everything upfront
            };
        const raw = yield getGrafanaSearcher().search(Object.assign(Object.assign({}, query), { tags }));
        return raw.view.map((v) => queryResultToViewItem(v, raw.view));
    });
}
export const FolderSection = ({ section, selectionToggle, onClickItem, onTagSelected, selection, renderStandaloneBody, tags, }) => {
    var _a, _b;
    const uid = section.uid;
    const editable = selectionToggle != null;
    const styles = useStyles2(getSectionHeaderStyles, editable);
    const [sectionExpanded, setSectionExpanded] = useState(() => {
        const lastExpandedFolder = window.localStorage.getItem(SEARCH_EXPANDED_FOLDER_STORAGE_KEY);
        return lastExpandedFolder === uid;
    });
    const results = useAsync(() => __awaiter(void 0, void 0, void 0, function* () {
        if (!sectionExpanded && !renderStandaloneBody) {
            return Promise.resolve([]);
        }
        const childItems = getChildren(section, tags);
        return childItems;
    }), [sectionExpanded, tags]);
    const onSectionExpand = () => {
        const newExpandedValue = !sectionExpanded;
        if (newExpandedValue) {
            // If we've just expanded the section, remember it to local storage
            window.localStorage.setItem(SEARCH_EXPANDED_FOLDER_STORAGE_KEY, uid);
        }
        else {
            // Else, when closing a section, remove it from local storage only if this folder was the most recently opened
            const lastExpandedFolder = window.localStorage.getItem(SEARCH_EXPANDED_FOLDER_STORAGE_KEY);
            if (lastExpandedFolder === uid) {
                window.localStorage.removeItem(SEARCH_EXPANDED_FOLDER_STORAGE_KEY);
            }
        }
        setSectionExpanded(newExpandedValue);
    };
    const onToggleFolder = (evt) => {
        var _a;
        evt.preventDefault();
        evt.stopPropagation();
        if (selectionToggle && selection) {
            const checked = !selection(section.kind, section.uid);
            selectionToggle(section.kind, section.uid);
            const sub = (_a = results.value) !== null && _a !== void 0 ? _a : [];
            for (const item of sub) {
                if (selection(item.kind, item.uid) !== checked) {
                    selectionToggle(item.kind, item.uid);
                }
            }
        }
    };
    const id = useId();
    const labelId = `section-header-label-${id}`;
    let icon = toIconName((_a = section.icon) !== null && _a !== void 0 ? _a : '');
    if (!icon) {
        icon = sectionExpanded ? 'folder-open' : 'folder';
    }
    const renderResults = () => {
        if (!results.value) {
            return null;
        }
        else if (results.value.length === 0 && !results.loading) {
            return (React.createElement(Card, null,
                React.createElement(Card.Heading, null, "No results found")));
        }
        return results.value.map((item) => {
            return (React.createElement(SearchItem, { key: item.uid, item: item, onTagSelected: onTagSelected, onToggleChecked: (item) => selectionToggle === null || selectionToggle === void 0 ? void 0 : selectionToggle(item.kind, item.uid), editable: Boolean(selection != null), onClickItem: onClickItem, isSelected: selection === null || selection === void 0 ? void 0 : selection(item.kind, item.uid) }));
        });
    };
    // Skip the folder wrapper
    if (renderStandaloneBody) {
        return (React.createElement("div", { className: styles.folderViewResults }, !((_b = results.value) === null || _b === void 0 ? void 0 : _b.length) && results.loading ? React.createElement(Spinner, { className: styles.spinner }) : renderResults()));
    }
    return (React.createElement(CollapsableSection, { headerDataTestId: selectors.components.Search.folderHeader(section.title), contentDataTestId: selectors.components.Search.folderContent(section.title), isOpen: sectionExpanded !== null && sectionExpanded !== void 0 ? sectionExpanded : false, onToggle: onSectionExpand, className: styles.wrapper, contentClassName: styles.content, loading: results.loading, labelId: labelId, label: React.createElement(React.Fragment, null,
            selectionToggle && selection && (
            // TODO: fix keyboard a11y
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
            React.createElement("div", { onClick: onToggleFolder },
                React.createElement(Checkbox, { className: styles.checkbox, value: selection(section.kind, section.uid), "aria-label": t('search.folder-view.select-folder', 'Select folder') }))),
            React.createElement("div", { className: styles.icon },
                React.createElement(Icon, { name: icon })),
            React.createElement("div", { className: styles.text },
                React.createElement("span", { id: labelId }, section.title),
                section.url && section.uid !== GENERAL_FOLDER_UID && (React.createElement("a", { href: section.url, className: styles.link },
                    React.createElement("span", { className: styles.separator }, "|"),
                    " ",
                    React.createElement(Icon, { name: "folder-upload" }),
                    ' ',
                    t('search.folder-view.go-to-folder', 'Go to folder'))))) }, results.value && React.createElement("ul", { className: styles.sectionItems }, renderResults())));
};
const getSectionHeaderStyles = (theme, editable) => {
    const sm = theme.spacing(1);
    return {
        wrapper: css `
      align-items: center;
      font-size: ${theme.typography.size.base};
      padding: 12px;
      border-bottom: none;
      color: ${theme.colors.text.secondary};
      z-index: 1;

      &:hover,
      &.selected {
        color: ${theme.colors.text};
      }

      &:hover,
      &:focus-visible,
      &:focus-within {
        a {
          opacity: 1;
        }
      }
    `,
        sectionItems: css `
      margin: 0 24px 0 32px;
    `,
        icon: css `
      padding: 0 ${sm} 0 ${editable ? 0 : sm};
    `,
        folderViewResults: css `
      overflow: auto;
    `,
        text: css `
      flex-grow: 1;
      line-height: 24px;
    `,
        link: css `
      padding: 2px 10px 0;
      color: ${theme.colors.text.secondary};
      opacity: 0;
      transition: opacity 150ms ease-in-out;
    `,
        separator: css `
      margin-right: 6px;
    `,
        content: css `
      padding-top: 0px;
      padding-bottom: 0px;
    `,
        spinner: css `
      display: grid;
      place-content: center;
      padding-bottom: 1rem;
    `,
        checkbox: css({
            marginRight: theme.spacing(1),
        }),
    };
};
//# sourceMappingURL=FolderSection.js.map