export var TableCell = function (_a) {
    var _b;
    var cell = _a.cell, field = _a.field, tableStyles = _a.tableStyles, onCellFilterAdded = _a.onCellFilterAdded, columnIndex = _a.columnIndex, columnCount = _a.columnCount;
    var cellProps = cell.getCellProps();
    if (!field.display) {
        return null;
    }
    if (cellProps.style) {
        cellProps.style.minWidth = cellProps.style.width;
        cellProps.style.justifyContent = cell.column.justifyContent;
    }
    var innerWidth = ((_b = cell.column.width) !== null && _b !== void 0 ? _b : 24) - tableStyles.cellPadding * 2;
    // last child sometimes have extra padding if there is a non overlay scrollbar
    if (columnIndex === columnCount - 1) {
        innerWidth -= tableStyles.lastChildExtraPadding;
    }
    return cell.render('Cell', {
        field: field,
        tableStyles: tableStyles,
        onCellFilterAdded: onCellFilterAdded,
        cellProps: cellProps,
        innerWidth: innerWidth,
    });
};
//# sourceMappingURL=TableCell.js.map