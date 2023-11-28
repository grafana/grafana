import React from 'react';
import { Icon, Tooltip } from '@grafana/ui';
import { Messages } from '../../AccessRole.messages';
const MetricsColumn = () => (React.createElement("span", null,
    Messages.metrics.column,
    React.createElement(Tooltip, { content: Messages.metrics.tooltip, theme: "info" },
        React.createElement(Icon, { name: "info-circle" }))));
export default MetricsColumn;
//# sourceMappingURL=MetricsColumn.js.map