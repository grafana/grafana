import { urlUtil } from '@grafana/data';
import { config, locationSearchToObject } from '@grafana/runtime';
import { SceneDataTransformer, sceneGraph, SceneQueryRunner, VizPanel, } from '@grafana/scenes';
import { initialIntervalVariableModelState } from 'app/features/variables/interval/reducer';
import { DashboardScene } from '../scene/DashboardScene';
export function getVizPanelKeyForPanelId(panelId) {
    return `panel-${panelId}`;
}
export function getPanelIdForVizPanel(panel) {
    return parseInt(panel.state.key.replace('panel-', ''), 10);
}
/**
 * This will also  try lookup based on panelId
 */
export function findVizPanelByKey(scene, key) {
    if (!key) {
        return null;
    }
    const panel = findVizPanelInternal(scene, key);
    if (panel) {
        return panel;
    }
    // Also try to find by panel id
    const id = parseInt(key, 10);
    if (isNaN(id)) {
        return null;
    }
    return findVizPanelInternal(scene, getVizPanelKeyForPanelId(id));
}
function findVizPanelInternal(scene, key) {
    if (!key) {
        return null;
    }
    const panel = sceneGraph.findObject(scene, (obj) => obj.state.key === key);
    if (panel) {
        if (panel instanceof VizPanel) {
            return panel;
        }
        else {
            throw new Error(`Found panel with key ${key} but it was not a VizPanel`);
        }
    }
    return null;
}
/**
 * Force re-render children. This is useful in some edge case scenarios when
 * children deep down the scene graph needs to be re-rendered when some parent state change.
 *
 * Example could be isEditing bool flag or a layout IsDraggable state flag.
 *
 * @param model The model whose children should be re-rendered. It does not force render this model, only the children.
 * @param recursive if it should keep force rendering down to leaf nodess
 */
export function forceRenderChildren(model, recursive) {
    model.forEachChild((child) => {
        if (!child.isActive) {
            return;
        }
        child.forceRender();
        forceRenderChildren(child, recursive);
    });
}
export function getDashboardUrl(options) {
    var _a, _b;
    let path = `/scenes/dashboard/${options.uid}${(_a = options.subPath) !== null && _a !== void 0 ? _a : ''}`;
    if (options.soloRoute) {
        path = `/d-solo/${options.uid}${(_b = options.subPath) !== null && _b !== void 0 ? _b : ''}`;
    }
    if (options.render) {
        path = '/render' + path;
        options.updateQuery = Object.assign(Object.assign({}, options.updateQuery), { width: 1000, height: 500, tz: options.timeZone });
    }
    const params = options.currentQueryParams ? locationSearchToObject(options.currentQueryParams) : {};
    if (options.updateQuery) {
        for (const key of Object.keys(options.updateQuery)) {
            // removing params with null | undefined
            if (options.updateQuery[key] === null || options.updateQuery[key] === undefined) {
                delete params[key];
            }
            else {
                params[key] = options.updateQuery[key];
            }
        }
    }
    const relativeUrl = urlUtil.renderUrl(path, params);
    if (options.absolute) {
        return config.appUrl + relativeUrl.slice(1);
    }
    return relativeUrl;
}
export function getMultiVariableValues(variable) {
    const { value, text, options } = variable.state;
    if (variable.hasAllValue()) {
        return {
            values: options.map((o) => o.value),
            texts: options.map((o) => o.label),
        };
    }
    return {
        values: Array.isArray(value) ? value : [value],
        texts: Array.isArray(text) ? text : [text],
    };
}
// Transform old interval model to new interval model from scenes
export function getIntervalsFromOldIntervalModel(variable) {
    var _a, _b;
    // separate intervals by quotes either single or double
    const matchIntervals = variable.query.match(/(["'])(.*?)\1|\w+/g);
    // If no intervals are found in query, return the initial state of the interval reducer.
    if (!matchIntervals) {
        return (_b = (_a = initialIntervalVariableModelState.query) === null || _a === void 0 ? void 0 : _a.split(',')) !== null && _b !== void 0 ? _b : [];
    }
    const uniqueIntervals = new Set();
    // when options are defined in variable.query
    const intervals = matchIntervals.reduce((uniqueIntervals, text) => {
        // Remove surrounding quotes from the interval value.
        const intervalValue = text.replace(/["']+/g, '');
        // Skip intervals that start with "$__auto_interval_",scenes will handle them.
        if (intervalValue.startsWith('$__auto_interval_')) {
            return uniqueIntervals;
        }
        // Add the interval if it's not already in the Set.
        uniqueIntervals.add(intervalValue);
        return uniqueIntervals;
    }, uniqueIntervals);
    return Array.from(intervals);
}
// Transform new interval scene model to old interval core model
export function getIntervalsQueryFromNewIntervalModel(intervals) {
    const variableQuery = Array.isArray(intervals) ? intervals.join(',') : '';
    return variableQuery;
}
export function getCurrentValueForOldIntervalModel(variable, intervals) {
    const selectedInterval = Array.isArray(variable.current.value) ? variable.current.value[0] : variable.current.value;
    // If the interval is the old auto format, return the new auto interval from scenes.
    if (selectedInterval.startsWith('$__auto_interval_')) {
        return '$__auto';
    }
    // Check if the selected interval is valid.
    if (intervals.includes(selectedInterval)) {
        return selectedInterval;
    }
    // If the selected interval is not valid, return the first valid interval.
    return intervals[0];
}
export function getQueryRunnerFor(sceneObject) {
    if (!sceneObject) {
        return undefined;
    }
    if (sceneObject.state.$data instanceof SceneQueryRunner) {
        return sceneObject.state.$data;
    }
    if (sceneObject.state.$data instanceof SceneDataTransformer) {
        return getQueryRunnerFor(sceneObject.state.$data);
    }
    return undefined;
}
export function getDashboardSceneFor(sceneObject) {
    const root = sceneObject.getRoot();
    if (root instanceof DashboardScene) {
        return root;
    }
    throw new Error('SceneObject root is not a DashboardScene');
}
export function getClosestVizPanel(sceneObject) {
    if (sceneObject instanceof VizPanel) {
        return sceneObject;
    }
    if (sceneObject.parent) {
        return getClosestVizPanel(sceneObject.parent);
    }
    return null;
}
//# sourceMappingURL=utils.js.map