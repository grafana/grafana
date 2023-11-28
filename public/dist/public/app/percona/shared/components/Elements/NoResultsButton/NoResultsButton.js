import React from 'react';
import { Button } from '@grafana/ui';
export const NoResultsButton = ({ buttonMessage, emptyMessage, onClick = () => null }) => {
    return (React.createElement("div", null,
        emptyMessage,
        React.createElement(Button, { onClick: onClick, size: "lg" }, buttonMessage)));
};
//# sourceMappingURL=NoResultsButton.js.map