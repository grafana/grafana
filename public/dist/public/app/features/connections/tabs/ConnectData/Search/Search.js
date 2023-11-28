import { css } from '@emotion/css';
import React from 'react';
import { Icon, Input, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';
const getStyles = (theme) => ({
    searchContainer: css `
    display: flex;
    margin: 16px 0;
    justify-content: space-between;

    position: sticky;
    top: 0;
    background-color: ${theme.colors.background.primary};
    z-index: 2;
    padding: ${theme.spacing(2)};
    margin: 0 -${theme.spacing(2)};
  `,
});
const placeholder = t('connections.search.placeholder', 'Search all');
export const Search = ({ onChange }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.searchContainer },
        React.createElement(Input, { onChange: onChange, prefix: React.createElement(Icon, { name: "search" }), placeholder: placeholder, "aria-label": "Search all" })));
};
//# sourceMappingURL=Search.js.map