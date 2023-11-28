import React, { forwardRef } from 'react';
function ConditionalWrap({ children, shouldWrap, wrap }, _ref) {
    return shouldWrap ? React.cloneElement(wrap(children)) : children;
}
export default forwardRef(ConditionalWrap);
//# sourceMappingURL=ConditionalWrap.js.map