import { css, cx } from '@emotion/css';
import React, { useState } from 'react';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { useMediaQueryChange } from 'app/core/hooks/useMediaQueryChange';
export function TopSearchBarSection({ children, align = 'left' }) {
    const styles = useStyles2(getStyles);
    const theme = useTheme2();
    const breakpoint = theme.breakpoints.values.sm;
    const [isSmallScreen, setIsSmallScreen] = useState(!window.matchMedia(`(min-width: ${breakpoint}px)`).matches);
    useMediaQueryChange({
        breakpoint,
        onChange: (e) => {
            setIsSmallScreen(!e.matches);
        },
    });
    if (isSmallScreen) {
        return React.createElement(React.Fragment, null, children);
    }
    return (React.createElement("div", { "data-testid": "wrapper", className: cx(styles.wrapper, { [styles[align]]: align === 'right' }) }, children));
}
const getStyles = (theme) => ({
    wrapper: css({
        display: 'flex',
        gap: theme.spacing(0.5),
        alignItems: 'center',
    }),
    right: css({
        justifyContent: 'flex-end',
    }),
    left: css({}),
    center: css({}),
});
//# sourceMappingURL=TopSearchBarSection.js.map