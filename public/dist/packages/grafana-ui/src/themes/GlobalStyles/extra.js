import { css } from '@emotion/react';
export function getExtraStyles(theme) {
    return css({
        // fix white background on intercom in dark mode
        'iframe.intercom-borderless-frame': {
            colorScheme: theme.colors.mode,
        },
    });
}
//# sourceMappingURL=extra.js.map