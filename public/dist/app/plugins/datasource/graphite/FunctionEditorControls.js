import React from 'react';
var FunctionHelpButton = function (props) {
    if (props.description) {
        return React.createElement("span", { className: "pointer fa fa-question-circle", onClick: props.onDescriptionShow });
    }
    return (React.createElement("span", { className: "pointer fa fa-question-circle", onClick: function () {
            window.open('http://graphite.readthedocs.org/en/latest/functions.html#graphite.render.functions.' + props.name, '_blank');
        } }));
};
export var FunctionEditorControls = function (props) {
    var func = props.func, onMoveLeft = props.onMoveLeft, onMoveRight = props.onMoveRight, onRemove = props.onRemove, onDescriptionShow = props.onDescriptionShow;
    return (React.createElement("div", { style: {
            display: 'flex',
            width: '60px',
            justifyContent: 'space-between',
        } },
        React.createElement("span", { className: "pointer fa fa-arrow-left", onClick: function () { return onMoveLeft(func); } }),
        React.createElement(FunctionHelpButton, { name: func.def.name, description: func.def.description, onDescriptionShow: onDescriptionShow }),
        React.createElement("span", { className: "pointer fa fa-remove", onClick: function () { return onRemove(func); } }),
        React.createElement("span", { className: "pointer fa fa-arrow-right", onClick: function () { return onMoveRight(func); } })));
};
//# sourceMappingURL=FunctionEditorControls.js.map