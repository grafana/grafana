var QueryActionComponents = /** @class */ (function () {
    function QueryActionComponents() {
        this.extraRenderActions = [];
    }
    QueryActionComponents.prototype.addExtraRenderAction = function (extra) {
        this.extraRenderActions = this.extraRenderActions.concat(extra);
    };
    QueryActionComponents.prototype.getAllExtraRenderAction = function () {
        return this.extraRenderActions;
    };
    return QueryActionComponents;
}());
/**
 * @internal and experimental
 */
export var GroupActionComponents = new QueryActionComponents();
/**
 * @internal and experimental
 */
export var RowActionComponents = new QueryActionComponents();
//# sourceMappingURL=QueryActionComponent.js.map