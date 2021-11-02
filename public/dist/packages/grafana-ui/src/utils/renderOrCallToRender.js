import React from 'react';
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
    if (typeof itemToRender === 'function') {
        return itemToRender(props);
    }
    throw new Error(itemToRender + " is not a React element nor a function that returns React element");
}
//# sourceMappingURL=renderOrCallToRender.js.map