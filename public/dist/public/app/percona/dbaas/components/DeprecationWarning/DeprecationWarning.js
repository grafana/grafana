import React from 'react';
import { Alert } from '@grafana/ui';
import { EVEREST_LINK, MIGRATION_GUIDE_LINK } from './DeprecationWarning.constants';
import { Messages } from './DeprecationWarning.messages';
const DbaasDeprecationWarning = () => (React.createElement("div", null,
    React.createElement(Alert, { title: Messages.title, severity: "warning" },
        Messages.warning,
        React.createElement("a", { target: "_blank", rel: "noopener noreferrer", href: EVEREST_LINK }, Messages.everest),
        Messages.warningCont,
        React.createElement("a", { target: "_blank", rel: "noopener noreferrer", href: MIGRATION_GUIDE_LINK }, Messages.guide),
        Messages.dot)));
export default DbaasDeprecationWarning;
//# sourceMappingURL=DeprecationWarning.js.map