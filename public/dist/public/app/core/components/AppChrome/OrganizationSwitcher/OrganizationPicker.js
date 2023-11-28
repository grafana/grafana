import { css } from '@emotion/css';
import React from 'react';
import { ValuePicker, useStyles2 } from '@grafana/ui';
export function OrganizationPicker({ orgs, onSelectChange }) {
    const styles = useStyles2(getStyles);
    return (React.createElement(ValuePicker, { "aria-label": "Change organization", variant: "secondary", buttonCss: styles.buttonCss, size: "md", label: "", fill: "text", isFullWidth: false, options: orgs.map((org) => ({
            label: org.name,
            description: org.role,
            value: org,
        })), onChange: onSelectChange, icon: "building" }));
}
const getStyles = (theme) => ({
    buttonCss: css({
        color: theme.colors.text.secondary,
        '&:hover': {
            color: theme.colors.text.primary,
        },
    }),
});
//# sourceMappingURL=OrganizationPicker.js.map