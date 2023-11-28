import { css } from '@emotion/css';
import React from 'react';
import { config } from '@grafana/runtime';
import { Button, Checkbox, HorizontalGroup, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { SortPicker } from 'app/core/components/Select/SortPicker';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { t, Trans } from 'app/core/internationalization';
import { SearchLayout } from '../../types';
function getLayoutOptions() {
    return [
        {
            value: SearchLayout.Folders,
            icon: 'folder',
            description: t('search.actions.view-as-folders', 'View by folders'),
        },
        { value: SearchLayout.List, icon: 'list-ul', description: t('search.actions.view-as-list', 'View as list') },
    ];
}
export function getValidQueryLayout(q) {
    var _a;
    const layout = (_a = q.layout) !== null && _a !== void 0 ? _a : SearchLayout.Folders;
    // Folders is not valid when a query exists
    if (layout === SearchLayout.Folders) {
        if (q.query || q.sort || q.starred || q.tag.length > 0) {
            return SearchLayout.List;
        }
    }
    return layout;
}
export const ActionRow = ({ onLayoutChange, onSortChange, onStarredFilterChange = () => { }, onTagFilterChange, getTagOptions, getSortOptions, sortPlaceholder, onDatasourceChange, onPanelTypeChange, onSetIncludePanels, state, showStarredFilter, hideLayout, }) => {
    const styles = useStyles2(getStyles);
    const layout = getValidQueryLayout(state);
    // Disabled folder layout option when query is present
    const disabledOptions = state.query || state.datasource || state.panel_type ? [SearchLayout.Folders] : [];
    return (React.createElement("div", { className: styles.actionRow },
        React.createElement(HorizontalGroup, { spacing: "md", width: "auto" },
            React.createElement(TagFilter, { isClearable: false, tags: state.tag, tagOptions: getTagOptions, onChange: onTagFilterChange }),
            config.featureToggles.panelTitleSearch && (React.createElement(Checkbox, { "data-testid": "include-panels", disabled: layout === SearchLayout.Folders, value: state.includePanels, onChange: () => onSetIncludePanels(!state.includePanels), label: t('search.actions.include-panels', 'Include panels') })),
            showStarredFilter && (React.createElement("div", { className: styles.checkboxWrapper },
                React.createElement(Checkbox, { label: t('search.actions.starred', 'Starred'), onChange: onStarredFilterChange, value: state.starred }))),
            state.datasource && (React.createElement(Button, { icon: "times", variant: "secondary", onClick: () => onDatasourceChange(undefined) },
                React.createElement(Trans, { i18nKey: "search.actions.remove-datasource-filter" },
                    "Datasource: ",
                    { datasource: state.datasource }))),
            state.panel_type && (React.createElement(Button, { icon: "times", variant: "secondary", onClick: () => onPanelTypeChange(undefined) },
                "Panel: ",
                state.panel_type))),
        React.createElement(HorizontalGroup, { spacing: "md", width: "auto" },
            !hideLayout && (React.createElement(RadioButtonGroup, { options: getLayoutOptions(), disabledOptions: disabledOptions, onChange: onLayoutChange, value: layout })),
            React.createElement(SortPicker, { onChange: (change) => onSortChange(change === null || change === void 0 ? void 0 : change.value), value: state.sort, getSortOptions: getSortOptions, placeholder: sortPlaceholder || t('search.actions.sort-placeholder', 'Sort'), isClearable: true }))));
};
ActionRow.displayName = 'ActionRow';
export const getStyles = (theme) => {
    return {
        actionRow: css `
      display: none;

      ${theme.breakpoints.up('md')} {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: ${theme.spacing(2)};
        width: 100%;
      }
    `,
        checkboxWrapper: css `
      label {
        line-height: 1.2;
      }
    `,
    };
};
//# sourceMappingURL=ActionRow.js.map