import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { Overlay } from 'app/percona/shared/components/Elements/Overlay';
import { getStyles } from './WidgetWrapper.styles';
export const WidgetWrapper = ({ children, title, isPending = false }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement(Overlay, { dataTestId: "contact-loading", isPending: isPending },
            React.createElement("div", { className: styles.widgetWrapper },
                title && (React.createElement("span", { className: styles.widgetTitle },
                    React.createElement("strong", null, title))),
                !isPending && children))));
};
//# sourceMappingURL=WidgetWrapper.js.map