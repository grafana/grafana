import React from 'react';
/** Returns the ID value of the first, and only, child element  */
export function getChildId(children) {
    let inputId;
    // Get the first, and only, child to retrieve form input's id
    const child = React.Children.only(children);
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
/**
 * Given react node or function returns element accordingly
 *
 * @param itemToRender
 * @param props props to be passed to the function if item provided as such
 */
export function renderOrCallToRender(itemToRender, props) {
    if (React.isValidElement(itemToRender) || typeof itemToRender === 'string' || typeof itemToRender === 'number') {
        return itemToRender;
    }
    if (typeof itemToRender === 'function' && props) {
        return itemToRender(props);
    }
    throw new Error(`${itemToRender} is not a React element nor a function that returns React element`);
}
//# sourceMappingURL=reactUtils.js.map