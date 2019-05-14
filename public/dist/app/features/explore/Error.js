import React from 'react';
export var Alert = function (props) {
    var message = props.message;
    return (React.createElement("div", { className: "gf-form-group section" },
        React.createElement("div", { className: "alert-error alert" },
            React.createElement("div", { className: "alert-icon" },
                React.createElement("i", { className: "fa fa-exclamation-triangle" })),
            React.createElement("div", { className: "alert-body" },
                React.createElement("div", { className: "alert-title" }, message)))));
};
//# sourceMappingURL=Error.js.map