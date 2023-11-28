import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { Messages } from './SectionLabel.messages';
import { getStyles } from './SectionLabel.styles';
export const Label = ({ name, endDate }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("span", { className: styles.labelWrapper },
        name,
        React.createElement("span", { className: styles.label },
            Messages.expiryDate,
            ": ",
            endDate)));
};
//# sourceMappingURL=SectionLabel.js.map