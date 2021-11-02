import { __assign } from "tslib";
import React from 'react';
import { getCellLinks } from '../../utils';
export var ImageCell = function (props) {
    var field = props.field, cell = props.cell, tableStyles = props.tableStyles, row = props.row, cellProps = props.cellProps;
    var displayValue = field.display(cell.value);
    var _a = getCellLinks(field, row), link = _a.link, onClick = _a.onClick;
    return (React.createElement("div", __assign({}, cellProps, { className: tableStyles.cellContainer }),
        !link && React.createElement("img", { src: displayValue.text, className: tableStyles.imageCell }),
        link && (React.createElement("a", { href: link.href, onClick: onClick, target: link.target, title: link.title, className: tableStyles.imageCellLink },
            React.createElement("img", { src: displayValue.text, className: tableStyles.imageCell })))));
};
//# sourceMappingURL=ImageCell.js.map