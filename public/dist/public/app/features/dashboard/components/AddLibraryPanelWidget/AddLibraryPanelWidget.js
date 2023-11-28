import { css, cx, keyframes } from '@emotion/css';
import React from 'react';
import tinycolor from 'tinycolor2';
import { IconButton, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { LibraryPanelsSearch, LibraryPanelsSearchVariant, } from '../../../library-panels/components/LibraryPanelsSearch/LibraryPanelsSearch';
export const AddLibraryPanelWidget = ({ panel, dashboard }) => {
    const onCancelAddPanel = (evt) => {
        evt.preventDefault();
        dashboard.removePanel(panel);
    };
    const onAddLibraryPanel = (panelInfo) => {
        const { gridPos } = panel;
        const newPanel = Object.assign(Object.assign({}, panelInfo.model), { gridPos, libraryPanel: panelInfo });
        dashboard.addPanel(newPanel);
        dashboard.removePanel(panel);
    };
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement("div", { className: cx('panel-container', styles.callToAction) },
            React.createElement("div", { className: cx(styles.headerRow, 'grid-drag-handle') },
                React.createElement("span", null,
                    React.createElement(Trans, { i18nKey: "library-panel.add-widget.title" }, "Add panel from panel library")),
                React.createElement("div", { className: "flex-grow-1" }),
                React.createElement(IconButton, { "aria-label": "Close 'Add Panel' widget", name: "times", onClick: onCancelAddPanel, tooltip: "Close widget" })),
            React.createElement(LibraryPanelsSearch, { onClick: onAddLibraryPanel, variant: LibraryPanelsSearchVariant.Tight, showPanelFilter: true }))));
};
const getStyles = (theme) => {
    const pulsate = keyframes({
        '0%': {
            boxShadow: `0 0 0 2px ${theme.colors.background.canvas}, 0 0 0px 4px ${theme.colors.primary.main}`,
        },
        '50%': {
            boxShadow: `0 0 0 2px ${theme.components.dashboard.background}, 0 0 0px 4px ${tinycolor(theme.colors.primary.main)
                .darken(20)
                .toHexString()}`,
        },
        '100%': {
            boxShadow: `0 0 0 2px ${theme.components.dashboard.background}, 0 0 0px 4px  ${theme.colors.primary.main}`,
        },
    });
    return {
        // wrapper is used to make sure box-shadow animation isn't cut off in dashboard page
        wrapper: css({
            height: '100%',
            paddingTop: `${theme.spacing(0.5)}`,
        }),
        headerRow: css({
            display: 'flex',
            alignItems: 'center',
            height: '38px',
            flexShrink: 0,
            width: '100%',
            fontSize: theme.typography.fontSize,
            fontWeight: theme.typography.fontWeightMedium,
            paddingLeft: `${theme.spacing(1)}`,
            transition: 'background-color 0.1s ease-in-out',
            cursor: 'move',
            '&:hover': {
                background: `${theme.colors.background.secondary}`,
            },
        }),
        callToAction: css({
            overflow: 'hidden',
            outline: '2px dotted transparent',
            outlineOffset: '2px',
            boxShadow: '0 0 0 2px black, 0 0 0px 4px #1f60c4',
            animation: `${pulsate} 2s ease infinite`,
        }),
    };
};
//# sourceMappingURL=AddLibraryPanelWidget.js.map