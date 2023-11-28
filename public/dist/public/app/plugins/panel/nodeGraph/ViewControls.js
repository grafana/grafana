import { css } from '@emotion/css';
import React, { useState } from 'react';
import { Button, HorizontalGroup, useStyles2, VerticalGroup } from '@grafana/ui';
function getStyles() {
    return {
        wrapper: css `
      label: wrapper;
      pointer-events: all;
    `,
    };
}
/**
 * Control buttons for zoom but also some layout config inputs mainly for debugging.
 */
export function ViewControls(props) {
    const { config, onConfigChange, onPlus, onMinus, disableZoomOut, disableZoomIn } = props;
    const [showConfig, setShowConfig] = useState(false);
    // For debugging the layout, should be removed here and maybe moved to panel config later on
    const allowConfiguration = false;
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement(VerticalGroup, { spacing: "sm" },
            React.createElement(HorizontalGroup, { spacing: "xs" },
                React.createElement(Button, { icon: 'plus-circle', onClick: onPlus, size: 'md', title: 'Zoom in', variant: "secondary", disabled: disableZoomIn }),
                React.createElement(Button, { icon: 'minus-circle', onClick: onMinus, size: 'md', title: 'Zoom out', variant: "secondary", disabled: disableZoomOut })),
            React.createElement(HorizontalGroup, { spacing: "xs" },
                React.createElement(Button, { icon: 'code-branch', onClick: () => onConfigChange(Object.assign(Object.assign({}, config), { gridLayout: false })), size: 'md', title: 'Default layout', variant: "secondary", disabled: !config.gridLayout }),
                React.createElement(Button, { icon: 'apps', onClick: () => onConfigChange(Object.assign(Object.assign({}, config), { gridLayout: true })), size: 'md', title: 'Grid layout', variant: "secondary", disabled: config.gridLayout }))),
        allowConfiguration && (React.createElement(Button, { size: 'xs', fill: "text", onClick: () => setShowConfig((showConfig) => !showConfig) }, showConfig ? 'Hide config' : 'Show config')),
        allowConfiguration &&
            showConfig &&
            Object.keys(config)
                .filter((k) => k !== 'show')
                .map((k) => (React.createElement("div", { key: k },
                k,
                React.createElement("input", { style: { width: 50 }, type: 'number', value: config[k], onChange: (e) => {
                        onConfigChange(Object.assign(Object.assign({}, config), { [k]: parseFloat(e.target.value) }));
                    } }))))));
}
//# sourceMappingURL=ViewControls.js.map