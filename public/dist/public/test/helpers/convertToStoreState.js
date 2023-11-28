import { getPreloadedState } from '../../app/features/variables/state/helpers';
export const convertToStoreState = (key, models) => {
    const variables = models.reduce((byName, variable) => {
        byName[variable.name] = variable;
        return byName;
    }, {});
    return Object.assign({}, getPreloadedState(key, { variables }));
};
//# sourceMappingURL=convertToStoreState.js.map