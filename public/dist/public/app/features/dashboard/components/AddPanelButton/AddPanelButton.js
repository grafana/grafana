import { css, cx } from '@emotion/css';
import React, { useState } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Dropdown, Button, useTheme2, Icon } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import AddPanelMenu from './AddPanelMenu';
const AddPanelButton = ({ dashboard }) => {
    const styles = getStyles(useTheme2());
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    return (React.createElement(Dropdown, { overlay: () => React.createElement(AddPanelMenu, { dashboard: dashboard }), placement: "bottom", offset: [0, 6], onVisibleChange: setIsMenuOpen },
        React.createElement(Button, { icon: "panel-add", size: "lg", fill: "text", className: cx(styles.button, styles.buttonIcon, styles.buttonText), "data-testid": selectors.components.PageToolbar.itemButton('Add button') },
            React.createElement(Trans, { i18nKey: "dashboard.toolbar.add" }, "Add"),
            React.createElement(Icon, { name: isMenuOpen ? 'angle-up' : 'angle-down', size: "lg" }))));
};
export default AddPanelButton;
function getStyles(theme) {
    return {
        button: css({
            label: 'add-panel-button',
            padding: theme.spacing(0.5, 0.5, 0.5, 0.75),
            height: theme.spacing((theme.components.height.sm + theme.components.height.md) / 2),
            borderRadius: theme.shape.radius.default,
        }),
        buttonIcon: css({
            svg: {
                margin: 0,
            },
        }),
        buttonText: css({
            label: 'add-panel-button-text',
            fontSize: theme.typography.body.fontSize,
            span: {
                marginLeft: theme.spacing(0.67),
            },
        }),
    };
}
//# sourceMappingURL=AddPanelButton.js.map