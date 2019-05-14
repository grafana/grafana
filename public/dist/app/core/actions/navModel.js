export var ActionTypes;
(function (ActionTypes) {
    ActionTypes["UpdateNavIndex"] = "UPDATE_NAV_INDEX";
})(ActionTypes || (ActionTypes = {}));
export var updateNavIndex = function (item) { return ({
    type: ActionTypes.UpdateNavIndex,
    payload: item,
}); };
//# sourceMappingURL=navModel.js.map