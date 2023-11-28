import { cx } from '@emotion/css';
import React, { useState } from 'react';
import { Field } from 'react-final-form';
import { Card, useStyles2 } from '@grafana/ui';
import { getStyles } from './PageSwitcherCard.styles';
export const PageSwitcherCard = ({ values, className }) => {
    const styles = useStyles2(getStyles);
    const [selectedStates, setSelectedStates] = useState(values.map((v) => ({ id: v.id, selected: v.selected })));
    const cardStyles = cx({
        [styles.wrapper]: true,
        [styles.disabled]: false,
    });
    return (React.createElement("div", { className: cx(styles.pageSwitcherWrapper, className) }, values.map((item) => (React.createElement(Field, { name: `${item.name}`, component: "input", type: "radio", key: `field-${item.id}`, value: item.value }, ({ input }) => {
        var _a;
        return (React.createElement(Card, { className: cardStyles, isSelected: (_a = selectedStates.find((v) => v.id === item.id)) === null || _a === void 0 ? void 0 : _a.selected, onClick: (e) => {
                e.preventDefault();
                setSelectedStates((states) => states.map((v) => ({ id: v.id, selected: v.id === item.id })));
                input.onChange({ target: { value: input.value } });
                item.onClick && item.onClick();
            }, "data-testid": `field-${item.id}` },
            React.createElement(Card.Heading, null, item.label),
            React.createElement(Card.Description, null, item.description)));
    })))));
};
//# sourceMappingURL=PageSwitcherCard.js.map