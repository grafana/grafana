export var reducerFactory = function (initialState) {
    var allMappers = {};
    var addMapper = function (config) {
        if (allMappers[config.filter.type]) {
            throw new Error("There is already a mapper defined with the type " + config.filter.type);
        }
        allMappers[config.filter.type] = config.mapper;
        return instance;
    };
    var create = function () { return function (state, action) {
        if (state === void 0) { state = initialState; }
        var mapper = allMappers[action.type];
        if (mapper) {
            return mapper(state, action);
        }
        return state;
    }; };
    var instance = { addMapper: addMapper, create: create };
    return instance;
};
//# sourceMappingURL=reducerFactory.js.map