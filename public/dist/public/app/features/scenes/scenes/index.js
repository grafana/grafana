import { getGridWithMultipleTimeRanges } from './gridMultiTimeRange';
import { getMultipleGridLayoutTest } from './gridMultiple';
import { getGridWithMultipleData } from './gridWithMultipleData';
import { getQueryVariableDemo } from './queryVariableDemo';
import { getRepeatingPanelsDemo, getRepeatingRowsDemo } from './repeatingPanels';
import { getSceneWithRows } from './sceneWithRows';
import { getTransformationsDemo } from './transformations';
import { getVariablesDemo, getVariablesDemoWithAll } from './variablesDemo';
export function getScenes() {
    return [
        { title: 'Scene with rows', getScene: getSceneWithRows },
        { title: 'Grid with rows and different queries', getScene: getGridWithMultipleData },
        { title: 'Grid with rows and different queries and time ranges', getScene: getGridWithMultipleTimeRanges },
        { title: 'Multiple grid layouts test', getScene: getMultipleGridLayoutTest },
        { title: 'Variables', getScene: getVariablesDemo },
        { title: 'Variables with All values', getScene: getVariablesDemoWithAll },
        { title: 'Variables - Repeating panels', getScene: getRepeatingPanelsDemo },
        { title: 'Variables - Repeating rows', getScene: getRepeatingRowsDemo },
        { title: 'Query variable', getScene: getQueryVariableDemo },
        { title: 'Transformations demo', getScene: getTransformationsDemo },
    ];
}
const cache = {};
export function getSceneByTitle(title) {
    if (cache[title]) {
        return cache[title];
    }
    const scene = getScenes().find((x) => x.title === title);
    if (scene) {
        cache[title] = scene.getScene();
    }
    return cache[title];
}
//# sourceMappingURL=index.js.map