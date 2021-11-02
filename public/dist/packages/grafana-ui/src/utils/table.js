/**
 * @internal
 */
export var getCellLinks = function (field, row) {
    var link;
    var onClick;
    if (field.getLinks) {
        link = field.getLinks({
            valueRowIndex: row.index,
        })[0];
    }
    //const fieldLink = link?.onClick;
    if (link === null || link === void 0 ? void 0 : link.onClick) {
        onClick = function (event) {
            // Allow opening in new tab
            if (!(event.ctrlKey || event.metaKey || event.shiftKey)) {
                event.preventDefault();
                link.onClick(event, {
                    field: field,
                    rowIndex: row.index,
                });
            }
        };
    }
    return {
        link: link,
        onClick: onClick,
    };
};
//# sourceMappingURL=table.js.map