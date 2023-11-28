import { css, cx } from '@emotion/css';
import React from 'react';
import { Card, useStyles2 } from '@grafana/ui';
const RuleType = (props) => {
    const { name, description, image, selected = false, value, onClick, disabled = false } = props;
    const styles = useStyles2(getStyles);
    const cardStyles = cx({
        [styles.wrapper]: true,
        [styles.disabled]: disabled,
    });
    return (React.createElement(Card, { className: cardStyles, isSelected: selected, onClick: () => onClick(value), disabled: disabled },
        React.createElement(Card.Figure, null,
            React.createElement("img", { src: image, alt: "" })),
        React.createElement(Card.Heading, null, name),
        React.createElement(Card.Description, null, description)));
};
const getStyles = (theme) => ({
    wrapper: css `
    width: 380px;
    cursor: pointer;
    user-select: none;
  `,
    disabled: css `
    opacity: 0.5;
  `,
});
export { RuleType };
//# sourceMappingURL=RuleType.js.map