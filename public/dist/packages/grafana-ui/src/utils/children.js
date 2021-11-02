import React from 'react';
/** Returns the ID value of the first, and only, child element  */
export function getChildId(children) {
    var inputId;
    // Get the first, and only, child to retrieve form input's id
    var child = React.Children.only(children);
    // Retrieve input's id to apply on the label for correct click interaction
    // For some components (like Select), we want to get the ID from a different prop
    if ('id' in (child === null || child === void 0 ? void 0 : child.props)) {
        inputId = child.props.id;
    }
    else if ('inputId' in child.props) {
        inputId = child === null || child === void 0 ? void 0 : child.props.inputId;
    }
    return typeof inputId === 'string' ? inputId : undefined;
}
//# sourceMappingURL=children.js.map