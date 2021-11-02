export var prepareItems = function (items, idCreator) {
    return items.map(function (item, index) {
        var _a;
        return ({
            id: (_a = idCreator === null || idCreator === void 0 ? void 0 : idCreator(item)) !== null && _a !== void 0 ? _a : index,
            data: item,
        });
    });
};
//# sourceMappingURL=dynamicTable.js.map