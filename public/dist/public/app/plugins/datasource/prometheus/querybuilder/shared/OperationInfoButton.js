import { css } from '@emotion/css';
import React, { useState } from 'react';
import { usePopperTooltip } from 'react-popper-tooltip';
import { renderMarkdown } from '@grafana/data';
import { FlexItem } from '@grafana/experimental';
import { Button, Portal, useStyles2 } from '@grafana/ui';
export const OperationInfoButton = React.memo(({ def, operation }) => {
    const styles = useStyles2(getStyles);
    const [show, setShow] = useState(false);
    const { getTooltipProps, setTooltipRef, setTriggerRef, visible } = usePopperTooltip({
        placement: 'top',
        visible: show,
        offset: [0, 16],
        onVisibleChange: setShow,
        interactive: true,
        trigger: ['click'],
    });
    return (React.createElement(React.Fragment, null,
        React.createElement(Button, { title: "Click to show description", ref: setTriggerRef, icon: "info-circle", size: "sm", variant: "secondary", fill: "text" }),
        visible && (React.createElement(Portal, null,
            React.createElement("div", Object.assign({ ref: setTooltipRef }, getTooltipProps(), { className: styles.docBox }),
                React.createElement("div", { className: styles.docBoxHeader },
                    React.createElement("span", null, def.renderer(operation, def, '<expr>')),
                    React.createElement(FlexItem, { grow: 1 }),
                    React.createElement(Button, { icon: "times", onClick: () => setShow(false), fill: "text", variant: "secondary", title: "Remove operation" })),
                React.createElement("div", { className: styles.docBoxBody, dangerouslySetInnerHTML: { __html: getOperationDocs(def, operation) } }))))));
});
OperationInfoButton.displayName = 'OperationDocs';
const getStyles = (theme) => {
    return {
        docBox: css({
            overflow: 'hidden',
            background: theme.colors.background.primary,
            border: `1px solid ${theme.colors.border.strong}`,
            boxShadow: theme.shadows.z3,
            maxWidth: '600px',
            padding: theme.spacing(1),
            borderRadius: theme.shape.radius.default,
            zIndex: theme.zIndex.tooltip,
        }),
        docBoxHeader: css({
            fontSize: theme.typography.h5.fontSize,
            fontFamily: theme.typography.fontFamilyMonospace,
            paddingBottom: theme.spacing(1),
            display: 'flex',
            alignItems: 'center',
        }),
        docBoxBody: css({
            // The markdown paragraph has a marginBottom this removes it
            marginBottom: theme.spacing(-1),
            color: theme.colors.text.secondary,
        }),
        signature: css({
            fontSize: theme.typography.bodySmall.fontSize,
            fontFamily: theme.typography.fontFamilyMonospace,
        }),
        dropdown: css({
            opacity: 0,
            color: theme.colors.text.secondary,
        }),
    };
};
function getOperationDocs(def, op) {
    var _a;
    return renderMarkdown(def.explainHandler ? def.explainHandler(op, def) : (_a = def.documentation) !== null && _a !== void 0 ? _a : 'no docs');
}
//# sourceMappingURL=OperationInfoButton.js.map