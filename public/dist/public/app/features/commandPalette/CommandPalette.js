import { css, cx } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import { KBarAnimator, KBarPortal, KBarPositioner, KBarSearch, VisualState, useRegisterActions, useKBar, ActionImpl, } from 'kbar';
import React, { useEffect, useMemo, useRef } from 'react';
import { reportInteraction } from '@grafana/runtime';
import { Icon, Spinner, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { KBarResults } from './KBarResults';
import { ResultItem } from './ResultItem';
import { useSearchResults } from './actions/dashboardActions';
import useActions from './actions/useActions';
import { useMatches } from './useMatches';
export function CommandPalette() {
    const styles = useStyles2(getSearchStyles);
    const { query, showing, searchQuery } = useKBar((state) => ({
        showing: state.visualState === VisualState.showing,
        searchQuery: state.searchQuery,
    }));
    const actions = useActions(searchQuery);
    useRegisterActions(actions, [actions]);
    const { searchResults, isFetchingSearchResults } = useSearchResults(searchQuery, showing);
    const ref = useRef(null);
    const { overlayProps } = useOverlay({ isOpen: showing, onClose: () => query.setVisualState(VisualState.animatingOut) }, ref);
    const { dialogProps } = useDialog({}, ref);
    // Report interaction when opened
    useEffect(() => {
        showing && reportInteraction('command_palette_opened');
    }, [showing]);
    return actions.length > 0 ? (React.createElement(KBarPortal, null,
        React.createElement(KBarPositioner, { className: styles.positioner },
            React.createElement(KBarAnimator, { className: styles.animator },
                React.createElement(FocusScope, { contain: true, autoFocus: true, restoreFocus: true },
                    React.createElement("div", Object.assign({}, overlayProps, dialogProps),
                        React.createElement("div", { className: styles.searchContainer },
                            isFetchingSearchResults ? React.createElement(Spinner, { className: styles.spinner }) : React.createElement(Icon, { name: "search", size: "md" }),
                            React.createElement(KBarSearch, { defaultPlaceholder: t('command-palette.search-box.placeholder', 'Search or jump to...'), className: styles.search })),
                        React.createElement("div", { className: styles.resultsContainer },
                            React.createElement(RenderResults, { searchResults: searchResults })))))))) : null;
}
const RenderResults = ({ searchResults }) => {
    const { results: kbarResults, rootActionId } = useMatches();
    const styles = useStyles2(getSearchStyles);
    const dashboardsSectionTitle = t('command-palette.section.dashboard-search-results', 'Dashboards');
    const foldersSectionTitle = t('command-palette.section.folder-search-results', 'Folders');
    // because dashboard search results aren't registered as actions, we need to manually
    // convert them to ActionImpls before passing them as items to KBarResults
    const dashboardResultItems = useMemo(() => searchResults
        .filter((item) => item.id.startsWith('go/dashboard'))
        .map((dashboard) => new ActionImpl(dashboard, { store: {} })), [searchResults]);
    const folderResultItems = useMemo(() => searchResults
        .filter((item) => item.id.startsWith('go/folder'))
        .map((folder) => new ActionImpl(folder, { store: {} })), [searchResults]);
    const items = useMemo(() => {
        const results = [...kbarResults];
        if (folderResultItems.length > 0) {
            results.push(foldersSectionTitle);
            results.push(...folderResultItems);
        }
        if (dashboardResultItems.length > 0) {
            results.push(dashboardsSectionTitle);
            results.push(...dashboardResultItems);
        }
        return results;
    }, [kbarResults, dashboardsSectionTitle, dashboardResultItems, foldersSectionTitle, folderResultItems]);
    return (React.createElement(KBarResults, { items: items, maxHeight: 650, onRender: ({ item, active }) => {
            const isFirst = items[0] === item;
            const renderedItem = typeof item === 'string' ? (React.createElement("div", { className: cx(styles.sectionHeader, isFirst && styles.sectionHeaderFirst) }, item)) : (React.createElement(ResultItem, { action: item, active: active, currentRootActionId: rootActionId }));
            return renderedItem;
        } }));
};
const getSearchStyles = (theme) => {
    return {
        positioner: css({
            zIndex: theme.zIndex.portal,
            marginTop: '0px',
            paddingTop: '4px !important',
            '&::before': {
                content: '""',
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                background: theme.components.overlay.background,
                backdropFilter: 'blur(1px)',
            },
        }),
        animator: css({
            maxWidth: theme.breakpoints.values.md,
            width: '100%',
            background: theme.colors.background.primary,
            color: theme.colors.text.primary,
            borderRadius: theme.shape.radius.default,
            border: `1px solid ${theme.colors.border.weak}`,
            overflow: 'hidden',
            boxShadow: theme.shadows.z3,
        }),
        searchContainer: css({
            alignItems: 'center',
            background: theme.components.input.background,
            borderBottom: `1px solid ${theme.colors.border.weak}`,
            display: 'flex',
            gap: theme.spacing(1),
            padding: theme.spacing(1, 2),
        }),
        search: css({
            fontSize: theme.typography.fontSize,
            width: '100%',
            boxSizing: 'border-box',
            outline: 'none',
            border: 'none',
            color: theme.components.input.text,
        }),
        spinner: css({
            height: '22px',
        }),
        resultsContainer: css({
            paddingBottom: theme.spacing(1),
        }),
        sectionHeader: css({
            padding: theme.spacing(1.5, 2, 2, 2),
            fontSize: theme.typography.bodySmall.fontSize,
            fontWeight: theme.typography.fontWeightMedium,
            color: theme.colors.text.secondary,
            borderTop: `1px solid ${theme.colors.border.weak}`,
            marginTop: theme.spacing(1),
        }),
        sectionHeaderFirst: css({
            paddingBottom: theme.spacing(1),
            borderTop: 'none',
            marginTop: 0,
        }),
    };
};
//# sourceMappingURL=CommandPalette.js.map