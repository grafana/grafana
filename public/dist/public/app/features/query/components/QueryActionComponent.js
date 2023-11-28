class QueryActionComponents {
    constructor() {
        this.extraRenderActions = [];
    }
    addExtraRenderAction(extra) {
        this.extraRenderActions = this.extraRenderActions.concat(extra);
    }
    getAllExtraRenderAction() {
        return this.extraRenderActions;
    }
}
/**
 * @internal and experimental
 */
export const GroupActionComponents = new QueryActionComponents();
/**
 * @internal and experimental
 */
export const RowActionComponents = new QueryActionComponents();
//# sourceMappingURL=QueryActionComponent.js.map