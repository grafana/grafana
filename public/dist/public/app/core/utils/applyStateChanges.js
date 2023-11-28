export const applyStateChanges = (state, ...args) => {
    return args.reduce((all, cur) => {
        return cur(all);
    }, state);
};
//# sourceMappingURL=applyStateChanges.js.map