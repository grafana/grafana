import { css } from '@emotion/css';
import React from 'react';
import { TagList, useStyles2 } from '@grafana/ui';
import { matcherToOperator } from '../../utils/alertmanager';
export const Matchers = ({ matchers }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", null,
        React.createElement(TagList, { className: styles.tags, tags: matchers.map((matcher) => `${matcher.name}${matcherToOperator(matcher)}${matcher.value}`) })));
};
const getStyles = () => ({
    tags: css `
    justify-content: flex-start;
  `,
});
//# sourceMappingURL=Matchers.js.map