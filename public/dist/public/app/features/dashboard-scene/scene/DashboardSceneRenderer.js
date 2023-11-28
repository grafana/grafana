import { css } from '@emotion/css';
import React from 'react';
import { useLocation } from 'react-router-dom';
import { PageLayoutType } from '@grafana/data';
import { SceneDebugger } from '@grafana/scenes';
import { CustomScrollbar, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { NavToolbarActions } from './NavToolbarActions';
export function DashboardSceneRenderer({ model }) {
    const { controls, viewPanelKey: viewPanelId, overlay } = model.useState();
    const styles = useStyles2(getStyles);
    const location = useLocation();
    const pageNav = model.getPageNav(location);
    const bodyToRender = model.getBodyToRender(viewPanelId);
    return (React.createElement(Page, { navId: "scenes", pageNav: pageNav, layout: PageLayoutType.Custom },
        React.createElement(CustomScrollbar, { autoHeightMin: '100%' },
            React.createElement("div", { className: styles.canvasContent },
                React.createElement(NavToolbarActions, { dashboard: model }),
                controls && (React.createElement("div", { className: styles.controls },
                    controls.map((control) => (React.createElement(control.Component, { key: control.state.key, model: control }))),
                    React.createElement(SceneDebugger, { scene: model, key: 'scene-debugger' }))),
                React.createElement("div", { className: styles.body },
                    React.createElement(bodyToRender.Component, { model: bodyToRender })))),
        overlay && React.createElement(overlay.Component, { model: overlay })));
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
        }),
        body: css({
            label: 'body',
            flexGrow: 1,
            display: 'flex',
            gap: '8px',
            marginBottom: theme.spacing(2),
        }),
        controls: css({
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: theme.spacing(1),
            position: 'sticky',
            top: 0,
            background: theme.colors.background.canvas,
            zIndex: 1,
            padding: theme.spacing(2, 0),
        }),
    };
}
//# sourceMappingURL=DashboardSceneRenderer.js.map