import { css } from '@emotion/css';
import React, { useState } from 'react';
import { Icon, Select, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
export function OrganizationSelect({ orgs, onSelectChange }) {
    const styles = useStyles2(getStyles);
    const { orgName: name, orgId, orgRole: role } = contextSrv.user;
    const [value, setValue] = useState(() => ({
        label: name,
        value: { role, orgId, name },
        description: role,
    }));
    const onChange = (option) => {
        setValue(option);
        onSelectChange(option);
    };
    return (React.createElement(Select, { "aria-label": "Change organization", width: 'auto', value: value, prefix: React.createElement(Icon, { className: "prefix-icon", name: "building" }), className: styles.select, options: orgs.map((org) => ({
            label: org.name,
            description: org.role,
            value: org,
        })), onChange: onChange }));
}
const getStyles = (theme) => ({
    select: css({
        border: 'none',
        background: 'none',
        color: theme.colors.text.secondary,
        '&:hover': {
            color: theme.colors.text.primary,
            '& .prefix-icon': css({
                color: theme.colors.text.primary,
            }),
        },
    }),
});
//# sourceMappingURL=OrganizationSelect.js.map