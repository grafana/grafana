import { css, cx } from '@emotion/css';
import React from 'react';
import { IconButton, useStyles2 } from '@grafana/ui';
export const MinimalisticPagination = ({ currentPage, numberOfPages, onNavigate, hideWhenSinglePage, className, }) => {
    const styles = useStyles2(getStyles);
    if (hideWhenSinglePage && numberOfPages <= 1) {
        return null;
    }
    return (React.createElement("div", { className: cx(styles.wrapper, className) },
        React.createElement(IconButton, { name: "angle-left", size: "md", tooltip: "Previous", onClick: () => onNavigate(currentPage - 1), disabled: currentPage === 1 }),
        currentPage,
        " of ",
        numberOfPages,
        React.createElement(IconButton, { name: "angle-right", size: "md", tooltip: "Next", onClick: () => onNavigate(currentPage + 1), disabled: currentPage === numberOfPages })));
};
const getStyles = (theme) => ({
    wrapper: css({
        display: 'flex',
        flexDirection: 'row',
        gap: 16,
    }),
});
//# sourceMappingURL=MinimalisticPagination.js.map