export var CoreActionTypes;
(function (CoreActionTypes) {
    CoreActionTypes["UpdateLocation"] = "UPDATE_LOCATION";
})(CoreActionTypes || (CoreActionTypes = {}));
export var updateLocation = function (location) { return ({
    type: CoreActionTypes.UpdateLocation,
    payload: location,
}); };
//# sourceMappingURL=location.js.map