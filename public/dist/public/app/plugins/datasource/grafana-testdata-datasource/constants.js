import { TestDataQueryType } from './dataquery.gen';
export const defaultPulseQuery = {
    timeStep: 60,
    onCount: 3,
    onValue: 2,
    offCount: 3,
    offValue: 1,
};
export const defaultCSVWaveQuery = [
    {
        timeStep: 60,
        valuesCSV: '0,0,2,2,1,1',
    },
];
export const defaultQuery = {
    scenarioId: TestDataQueryType.RandomWalk,
    refId: '',
};
//# sourceMappingURL=constants.js.map