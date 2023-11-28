import React, { useState } from 'react';
import { Collapse } from '@grafana/ui';
import { selectors } from '../../e2e/selectors';
import { Space } from '../Space';
const AdvancedMulti = ({ resources, onChange, renderAdvanced }) => {
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(!!resources.length && JSON.stringify(resources).includes('$'));
    return (React.createElement("div", { "data-testid": selectors.components.queryEditor.resourcePicker.advanced.collapse },
        React.createElement(Collapse, { collapsible: true, label: "Advanced", isOpen: isAdvancedOpen, onToggle: () => setIsAdvancedOpen(!isAdvancedOpen) },
            renderAdvanced(resources, onChange),
            React.createElement(Space, { v: 2 }))));
};
export default AdvancedMulti;
//# sourceMappingURL=AdvancedMulti.js.map