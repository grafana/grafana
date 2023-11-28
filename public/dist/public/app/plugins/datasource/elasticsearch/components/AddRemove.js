import { css } from '@emotion/css';
import React from 'react';
import { Button } from '@grafana/ui';
/**
 * A component used to show add & remove buttons for mutable lists of values. Wether to show or not the add or the remove buttons
 * depends on the `index` and `elements` props. This enforces a consistent experience whenever this pattern is used.
 */
export const AddRemove = ({ index, onAdd, onRemove, elements }) => {
    return (React.createElement("div", { className: css `
        display: flex;
      ` },
        index === 0 && (React.createElement(Button, { variant: "secondary", fill: "text", icon: "plus", onClick: onAdd, tooltip: "Add", "aria-label": "Add" })),
        elements.length >= 2 && (React.createElement(Button, { variant: "secondary", fill: "text", icon: "minus", onClick: onRemove, tooltip: "Remove", "aria-label": "Remove" }))));
};
//# sourceMappingURL=AddRemove.js.map