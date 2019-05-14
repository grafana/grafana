var allActionCreators = [];
export var actionCreatorFactory = function (type) {
    var create = function () {
        return Object.assign(function (payload) { return ({ type: type, payload: payload }); }, { type: type });
    };
    if (allActionCreators.some(function (t) { return (t && type ? t.toLocaleUpperCase() === type.toLocaleUpperCase() : false); })) {
        throw new Error("There is already an actionCreator defined with the type " + type);
    }
    allActionCreators.push(type);
    return { create: create };
};
export var noPayloadActionCreatorFactory = function (type) {
    var create = function () {
        return Object.assign(function () { return ({ type: type, payload: undefined }); }, { type: type });
    };
    if (allActionCreators.some(function (t) { return (t && type ? t.toLocaleUpperCase() === type.toLocaleUpperCase() : false); })) {
        throw new Error("There is already an actionCreator defined with the type " + type);
    }
    allActionCreators.push(type);
    return { create: create };
};
export var getNoPayloadActionCreatorMock = function (creator) {
    var mock = Object.assign(function () {
        mock.calls++;
        return { type: creator.type, payload: undefined };
    }, { type: creator.type, calls: 0 });
    return mock;
};
// Should only be used by tests
export var resetAllActionCreatorTypes = function () { return (allActionCreators.length = 0); };
//# sourceMappingURL=actionCreatorFactory.js.map