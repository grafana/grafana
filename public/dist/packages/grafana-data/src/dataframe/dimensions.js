export var createDimension = function (name, columns) {
    return {
        name: name,
        columns: columns,
    };
};
export var getColumnsFromDimension = function (dimension) {
    return dimension.columns;
};
export var getColumnFromDimension = function (dimension, column) {
    return dimension.columns[column];
};
export var getValueFromDimension = function (dimension, column, row) {
    return dimension.columns[column].values.get(row);
};
export var getAllValuesFromDimension = function (dimension, column, row) {
    return dimension.columns.map(function (c) { return c.values.get(row); });
};
export var getDimensionByName = function (dimensions, name) { return dimensions[name]; };
//# sourceMappingURL=dimensions.js.map