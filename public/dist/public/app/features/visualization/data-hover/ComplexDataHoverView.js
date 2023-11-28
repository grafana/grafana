import React, { useState } from 'react';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';
import { DataHoverRows } from './DataHoverRows';
import { DataHoverTabs } from './DataHoverTabs';
export const ComplexDataHoverView = ({ layers, onClose, isOpen }) => {
    const [activeTabIndex, setActiveTabIndex] = useState(0);
    if (!layers) {
        return null;
    }
    return (React.createElement(React.Fragment, null,
        isOpen && React.createElement(CloseButton, { style: { zIndex: 1 }, onClick: onClose }),
        React.createElement(DataHoverTabs, { layers: layers, setActiveTabIndex: setActiveTabIndex, activeTabIndex: activeTabIndex }),
        React.createElement(DataHoverRows, { layers: layers, activeTabIndex: activeTabIndex })));
};
//# sourceMappingURL=ComplexDataHoverView.js.map