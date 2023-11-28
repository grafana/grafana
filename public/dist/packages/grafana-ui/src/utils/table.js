/**
 * @internal
 */
export const getCellLinks = (field, row) => {
    let links;
    if (field.getLinks) {
        links = field.getLinks({
            valueRowIndex: row.index,
        });
    }
    if (!links) {
        return;
    }
    for (let i = 0; i < (links === null || links === void 0 ? void 0 : links.length); i++) {
        if (links[i].onClick) {
            const origOnClick = links[i].onClick;
            links[i].onClick = (event) => {
                // Allow opening in new tab
                if (!(event.ctrlKey || event.metaKey || event.shiftKey)) {
                    event.preventDefault();
                    origOnClick(event, {
                        field,
                        rowIndex: row.index,
                    });
                }
            };
        }
    }
    return links;
};
//# sourceMappingURL=table.js.map