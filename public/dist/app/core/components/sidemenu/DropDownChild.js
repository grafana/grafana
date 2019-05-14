import React from 'react';
var DropDownChild = function (props) {
    var child = props.child;
    var listItemClassName = child.divider ? 'divider' : '';
    return (React.createElement("li", { className: listItemClassName },
        React.createElement("a", { href: child.url },
            child.icon && React.createElement("i", { className: child.icon }),
            child.text)));
};
export default DropDownChild;
//# sourceMappingURL=DropDownChild.js.map