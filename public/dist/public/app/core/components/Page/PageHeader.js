import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { PageInfo } from '../PageInfo/PageInfo';
import { EditableTitle } from './EditableTitle';
export function PageHeader({ navItem, renderTitle, actions, info, subTitle, onEditTitle }) {
    const styles = useStyles2(getStyles);
    const sub = subTitle !== null && subTitle !== void 0 ? subTitle : navItem.subTitle;
    const titleElement = onEditTitle ? (React.createElement(EditableTitle, { value: navItem.text, onEdit: onEditTitle })) : (React.createElement("div", { className: styles.title },
        navItem.img && React.createElement("img", { className: styles.img, src: navItem.img, alt: `logo for ${navItem.text}` }),
        renderTitle ? renderTitle(navItem.text) : React.createElement("h1", null, navItem.text)));
    return (React.createElement("div", { className: styles.pageHeader },
        React.createElement("div", { className: styles.topRow },
            React.createElement("div", { className: styles.titleInfoContainer },
                titleElement,
                info && React.createElement(PageInfo, { info: info })),
            React.createElement("div", { className: styles.actions }, actions)),
        sub && React.createElement("div", { className: styles.subTitle }, sub)));
}
const getStyles = (theme) => {
    return {
        topRow: css({
            alignItems: 'flex-start',
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing(1, 3),
        }),
        title: css({
            display: 'flex',
            flexDirection: 'row',
            h1: {
                display: 'flex',
                marginBottom: 0,
            },
        }),
        actions: css({
            display: 'flex',
            flexDirection: 'row',
            gap: theme.spacing(1),
        }),
        titleInfoContainer: css({
            display: 'flex',
            label: 'title-info-container',
            flex: 1,
            flexWrap: 'wrap',
            gap: theme.spacing(1, 4),
            justifyContent: 'space-between',
            maxWidth: '100%',
            minWidth: '200px',
        }),
        pageHeader: css({
            label: 'page-header',
            display: 'flex',
            flexDirection: 'column',
            gap: theme.spacing(1),
            marginBottom: theme.spacing(2),
        }),
        subTitle: css({
            position: 'relative',
            color: theme.colors.text.secondary,
        }),
        img: css({
            width: '32px',
            height: '32px',
            marginRight: theme.spacing(2),
        }),
    };
};
//# sourceMappingURL=PageHeader.js.map