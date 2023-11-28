// Libraries
import React, { useEffect, useState } from 'react';
import { getUrlSyncManager } from '@grafana/scenes';
import { getSceneByTitle } from './scenes';
export const ScenePage = (props) => {
    const scene = getSceneByTitle(props.match.params.name);
    const [isInitialized, setInitialized] = useState(false);
    useEffect(() => {
        if (scene && !isInitialized) {
            getUrlSyncManager().initSync(scene);
            setInitialized(true);
        }
    }, [isInitialized, scene]);
    if (!scene) {
        return React.createElement("h2", null, "Scene not found");
    }
    if (!isInitialized) {
        return null;
    }
    return React.createElement(scene.Component, { model: scene });
};
export default ScenePage;
//# sourceMappingURL=ScenePage.js.map