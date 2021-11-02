import { Registry } from './Registry';
export var BinaryOperationID;
(function (BinaryOperationID) {
    BinaryOperationID["Add"] = "+";
    BinaryOperationID["Subtract"] = "-";
    BinaryOperationID["Divide"] = "/";
    BinaryOperationID["Multiply"] = "*";
})(BinaryOperationID || (BinaryOperationID = {}));
export var binaryOperators = new Registry(function () {
    return [
        {
            id: BinaryOperationID.Add,
            name: 'Add',
            operation: function (a, b) { return a + b; },
        },
        {
            id: BinaryOperationID.Subtract,
            name: 'Subtract',
            operation: function (a, b) { return a - b; },
        },
        {
            id: BinaryOperationID.Multiply,
            name: 'Multiply',
            operation: function (a, b) { return a * b; },
        },
        {
            id: BinaryOperationID.Divide,
            name: 'Divide',
            operation: function (a, b) { return a / b; },
        },
    ];
});
//# sourceMappingURL=binaryOperators.js.map