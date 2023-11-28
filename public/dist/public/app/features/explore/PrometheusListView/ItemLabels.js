import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui/';
import { InstantQueryRefIdIndex } from '../../../plugins/datasource/prometheus/datasource';
import { rawListItemColumnWidth } from './RawListItem';
const getItemLabelsStyles = (theme, expanded) => {
    return {
        valueNavigation: css `
      width: ${rawListItemColumnWidth};
      font-weight: bold;
    `,
        valueNavigationWrapper: css `
      display: flex;
      justify-content: flex-end;
    `,
        itemLabelsWrap: css `
      ${!expanded ? `border-bottom: 1px solid ${theme.colors.border.medium}` : ''};
    `,
    };
};
export const formatValueName = (name) => {
    if (name.includes(InstantQueryRefIdIndex)) {
        return name.replace(InstantQueryRefIdIndex, '');
    }
    return name;
};
export const ItemLabels = ({ valueLabels, expanded }) => {
    const styles = useStyles2(getItemLabelsStyles, expanded);
    return (React.createElement("div", { className: styles.itemLabelsWrap },
        React.createElement("div", { className: styles.valueNavigationWrapper }, valueLabels.map((value, index) => (React.createElement("span", { className: styles.valueNavigation, key: value.name }, formatValueName(value.name)))))));
};
//# sourceMappingURL=ItemLabels.js.map