import React from 'react';
import { styles } from './OptionContent.styles';
export const OptionContent = ({ title, description, tags, disabledTags, dataTestId }) => (React.createElement("div", { className: styles.optionWrapper, "data-testid": dataTestId },
    React.createElement("div", { className: styles.optionText },
        React.createElement("span", { className: styles.optionTitle }, title),
        React.createElement("span", { className: styles.optionDescription }, description)),
    React.createElement("div", { className: styles.tagWrapper },
        disabledTags &&
            disabledTags.map((tag) => (React.createElement("span", { key: tag, className: styles.notAvailableTag }, tag))),
        tags.map((tag) => (React.createElement("span", { key: tag, className: styles.tag }, tag))))));
//# sourceMappingURL=OptionContent.js.map