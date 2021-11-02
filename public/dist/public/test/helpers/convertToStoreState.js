export var convertToStoreState = function (variables) {
    return {
        templating: {
            variables: variables.reduce(function (byName, variable) {
                byName[variable.name] = variable;
                return byName;
            }, {}),
        },
    };
};
//# sourceMappingURL=convertToStoreState.js.map