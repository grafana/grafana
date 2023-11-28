import { css } from '@emotion/css';
import React from 'react';
import Skeleton from 'react-loading-skeleton';
import { reportInteraction } from '@grafana/runtime';
import { Icon, IconButton, Link, Spinner, useStyles2, Text } from '@grafana/ui';
import { getSvgSize } from '@grafana/ui/src/components/Icon/utils';
import { t } from 'app/core/internationalization';
import { getIconForKind } from 'app/features/search/service/utils';
import { Indent } from '../../../core/components/Indent/Indent';
import { useChildrenByParentUIDState } from '../state';
import { makeRowID } from './utils';
const CHEVRON_SIZE = 'md';
const ICON_SIZE = 'sm';
export function NameCell({ row: { original: data }, onFolderClick, treeID }) {
    const styles = useStyles2(getStyles);
    const { item, level, isOpen } = data;
    const childrenByParentUID = useChildrenByParentUIDState();
    const isLoading = isOpen && !childrenByParentUID[item.uid];
    const iconName = getIconForKind(data.item.kind, isOpen);
    if (item.kind === 'ui') {
        return (React.createElement(React.Fragment, null,
            React.createElement(Indent, { level: level, spacing: {
                    xs: 1,
                    md: 3,
                } }),
            React.createElement("span", { className: styles.folderButtonSpacer }),
            item.uiKind === 'empty-folder' ? (React.createElement("em", { className: styles.emptyText },
                React.createElement(Text, { variant: "body", color: "secondary", truncate: true }, "No items"))) : (React.createElement(Skeleton, { width: 200 }))));
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(Indent, { level: level, spacing: {
                xs: 1,
                md: 3,
            } }),
        item.kind === 'folder' ? (React.createElement(IconButton, { size: CHEVRON_SIZE, className: styles.chevron, onClick: () => {
                onFolderClick(item.uid, !isOpen);
            }, name: isOpen ? 'angle-down' : 'angle-right', "aria-label": isOpen
                ? t('browse-dashboards.dashboards-tree.collapse-folder-button', 'Collapse folder {{title}}', {
                    title: item.title,
                })
                : t('browse-dashboards.dashboards-tree.expand-folder-button', 'Expand folder {{title}}', {
                    title: item.title,
                }) })) : (React.createElement("span", { className: styles.folderButtonSpacer })),
        React.createElement("div", { className: styles.iconNameContainer },
            isLoading ? React.createElement(Spinner, { size: ICON_SIZE }) : React.createElement(Icon, { size: ICON_SIZE, name: iconName }),
            React.createElement(Text, { variant: "body", truncate: true, id: treeID && makeRowID(treeID, item) }, item.url ? (React.createElement(Link, { onClick: () => {
                    reportInteraction('manage_dashboards_result_clicked');
                }, href: item.url, className: styles.link }, item.title)) : (item.title)))));
}
const getStyles = (theme) => {
    return {
        chevron: css({
            marginRight: theme.spacing(1),
            width: getSvgSize(CHEVRON_SIZE),
        }),
        emptyText: css({
            // needed for text to truncate correctly
            overflow: 'hidden',
        }),
        // Should be the same size as the <IconButton /> so Dashboard name is aligned to Folder name siblings
        folderButtonSpacer: css({
            paddingLeft: `calc(${getSvgSize(CHEVRON_SIZE)}px + ${theme.spacing(1)})`,
        }),
        iconNameContainer: css({
            alignItems: 'center',
            display: 'flex',
            gap: theme.spacing(1),
            overflow: 'hidden',
        }),
        link: css({
            '&:hover': {
                textDecoration: 'underline',
            },
        }),
    };
};
//# sourceMappingURL=NameCell.js.map