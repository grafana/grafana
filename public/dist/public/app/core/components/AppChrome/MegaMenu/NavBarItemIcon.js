import { css, cx } from '@emotion/css';
import React from 'react';
import { Icon, toIconName, useTheme2 } from '@grafana/ui';
import { Branding } from '../../Branding/Branding';
export function NavBarItemIcon({ link }) {
    const theme = useTheme2();
    const styles = getStyles(theme);
    if (link.icon === 'grafana') {
        return React.createElement(Branding.MenuLogo, { className: styles.img });
    }
    else if (link.icon) {
        const iconName = toIconName(link.icon);
        return React.createElement(Icon, { name: iconName !== null && iconName !== void 0 ? iconName : 'link', size: "xl" });
    }
    else {
        // consumer of NavBarItemIcon gives enclosing element an appropriate label
        return React.createElement("img", { className: cx(styles.img, link.roundIcon && styles.round), src: link.img, alt: "" });
    }
}
function getStyles(theme) {
    return {
        img: css({
            height: theme.spacing(3),
            width: theme.spacing(3),
        }),
        round: css({
            borderRadius: theme.shape.radius.circle,
        }),
    };
}
//# sourceMappingURL=NavBarItemIcon.js.map