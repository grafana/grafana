import { css } from '@emotion/css';
import React, { useCallback } from 'react';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { Card, Icon, TagList, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { SEARCH_ITEM_HEIGHT } from '../constants';
import { getIconForKind } from '../service/utils';
import { SearchCheckbox } from './SearchCheckbox';
const selectors = e2eSelectors.components.Search;
const getIconFromMeta = (meta = '') => {
    const metaIconMap = new Map([
        ['errors', 'info-circle'],
        ['views', 'eye'],
    ]);
    return metaIconMap.has(meta) ? metaIconMap.get(meta) : 'sort-amount-down';
};
/** @deprecated */
export const SearchItem = ({ item, isSelected, editable, onToggleChecked, onTagSelected, onClickItem }) => {
    var _a, _b;
    const styles = useStyles2(getStyles);
    const tagSelected = useCallback((tag, event) => {
        event.stopPropagation();
        event.preventDefault();
        onTagSelected(tag);
    }, [onTagSelected]);
    const handleCheckboxClick = useCallback((ev) => {
        ev.stopPropagation();
        if (onToggleChecked) {
            onToggleChecked(item);
        }
    }, [item, onToggleChecked]);
    const description = config.featureToggles.nestedFolders ? (React.createElement(React.Fragment, null,
        React.createElement(Icon, { name: getIconForKind(item.kind), "aria-hidden": true }),
        " ",
        kindName(item.kind))) : (React.createElement(React.Fragment, null,
        React.createElement(Icon, { name: getIconForKind((_a = item.parentKind) !== null && _a !== void 0 ? _a : 'folder'), "aria-hidden": true }),
        " ",
        item.parentTitle || 'General'));
    return (React.createElement("div", { className: styles.cardContainer },
        React.createElement(SearchCheckbox, { className: styles.checkbox, "aria-label": "Select dashboard", editable: editable, checked: isSelected, onClick: handleCheckboxClick }),
        React.createElement(Card, { className: styles.card, "data-testid": selectors.dashboardItem(item.title), href: item.url, style: { minHeight: SEARCH_ITEM_HEIGHT }, onClick: onClickItem },
            React.createElement(Card.Heading, null, item.title),
            React.createElement(Card.Meta, { separator: '' },
                React.createElement("span", { className: styles.metaContainer }, description),
                item.sortMetaName && (React.createElement("span", { className: styles.metaContainer },
                    React.createElement(Icon, { name: getIconFromMeta(item.sortMetaName) }),
                    item.sortMeta,
                    " ",
                    item.sortMetaName))),
            React.createElement(Card.Tags, null,
                React.createElement(TagList, { tags: (_b = item.tags) !== null && _b !== void 0 ? _b : [], onClick: tagSelected, getAriaLabel: (tag) => `Filter by tag "${tag}"` })))));
};
function kindName(kind) {
    switch (kind) {
        case 'folder':
            return t('search.result-kind.folder', 'Folder');
        case 'dashboard':
            return t('search.result-kind.dashboard', 'Dashboard');
        case 'panel':
            return t('search.result-kind.panel', 'Panel');
    }
}
const getStyles = (theme) => {
    return {
        cardContainer: css `
      display: flex;
      align-items: center;
      margin-bottom: ${theme.spacing(0.75)};
    `,
        card: css `
      padding: ${theme.spacing(1)} ${theme.spacing(2)};
      margin-bottom: 0;
    `,
        checkbox: css({
            marginRight: theme.spacing(1),
        }),
        metaContainer: css `
      display: flex;
      align-items: center;
      margin-right: ${theme.spacing(1)};

      svg {
        margin-right: ${theme.spacing(0.5)};
      }
    `,
    };
};
//# sourceMappingURL=SearchItem.js.map