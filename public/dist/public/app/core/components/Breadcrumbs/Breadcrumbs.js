import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { BreadcrumbItem } from './BreadcrumbItem';
export function Breadcrumbs({ breadcrumbs, className }) {
    const styles = useStyles2(getStyles);
    return (React.createElement("nav", { "aria-label": "Breadcrumbs", className: className },
        React.createElement("ol", { className: styles.breadcrumbs }, breadcrumbs.map((breadcrumb, index) => (React.createElement(BreadcrumbItem, Object.assign({}, breadcrumb, { isCurrent: index === breadcrumbs.length - 1, key: index, index: index, flexGrow: getFlexGrow(index, breadcrumbs.length) })))))));
}
function getFlexGrow(index, length) {
    if (length < 5 && index > 0 && index < length - 2) {
        return 4;
    }
    if (length > 6 && index > 1 && index < length - 3) {
        return 4;
    }
    return 10;
}
const getStyles = (theme) => {
    return {
        breadcrumbs: css({
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'nowrap',
            overflow: 'hidden',
        }),
    };
};
//# sourceMappingURL=Breadcrumbs.js.map