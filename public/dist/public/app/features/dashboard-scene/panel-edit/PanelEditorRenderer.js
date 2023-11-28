import { css } from '@emotion/css';
import React from 'react';
import { useLocation } from 'react-router-dom';
import { PageLayoutType } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { NavToolbarSeparator } from 'app/core/components/AppChrome/NavToolbar/NavToolbarSeparator';
import { Page } from 'app/core/components/Page/Page';
export function PanelEditorRenderer({ model }) {
    const { body, controls, drawer } = model.useState();
    const styles = useStyles2(getStyles);
    const location = useLocation();
    const pageNav = model.getPageNav(location);
    return (React.createElement(Page, { navId: "scenes", pageNav: pageNav, layout: PageLayoutType.Custom },
        React.createElement(AppChromeUpdate, { actions: getToolbarActions(model) }),
        React.createElement("div", { className: styles.canvasContent },
            controls && (React.createElement("div", { className: styles.controls }, controls.map((control) => (React.createElement(control.Component, { key: control.state.key, model: control }))))),
            React.createElement("div", { className: styles.body },
                React.createElement(body.Component, { model: body }))),
        drawer && React.createElement(drawer.Component, { model: drawer })));
}
function getToolbarActions(editor) {
    return (React.createElement(React.Fragment, null,
        React.createElement(NavToolbarSeparator, { leftActionsSeparator: true, key: "separator" }),
        React.createElement(Button, { onClick: editor.onDiscard, tooltip: "", key: "panel-edit-discard", variant: "destructive", fill: "outline", size: "sm" }, "Discard"),
        React.createElement(Button, { onClick: editor.onApply, tooltip: "", key: "panel-edit-apply", variant: "primary", size: "sm" }, "Apply")));
}
function getStyles(theme) {
    return {
        canvasContent: css({
            label: 'canvas-content',
            display: 'flex',
            flexDirection: 'column',
            padding: theme.spacing(0, 2),
            flexBasis: '100%',
            flexGrow: 1,
            minHeight: 0,
            width: '100%',
        }),
        body: css({
            label: 'body',
            flexGrow: 1,
            display: 'flex',
            position: 'relative',
            minHeight: 0,
            gap: '8px',
            marginBottom: theme.spacing(2),
        }),
        controls: css({
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: theme.spacing(1),
            padding: theme.spacing(2, 0),
        }),
    };
}
//# sourceMappingURL=PanelEditorRenderer.js.map