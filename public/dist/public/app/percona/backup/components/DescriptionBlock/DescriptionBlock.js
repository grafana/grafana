import React from 'react';
import { useStyles } from '@grafana/ui';
import { Messages } from './DescriptionBlock.messages';
import { getStyles } from './DescriptionBlock.styles';
export const DescriptionBlock = ({ description, dataTestId }) => {
    const styles = useStyles(getStyles);
    return (React.createElement("div", { "data-testid": dataTestId, className: styles.descriptionWrapper },
        React.createElement("span", null, Messages.description),
        React.createElement("pre", null, description)));
};
//# sourceMappingURL=DescriptionBlock.js.map