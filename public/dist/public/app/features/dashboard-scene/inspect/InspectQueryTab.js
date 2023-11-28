import React from 'react';
import { sceneGraph, SceneObjectBase, } from '@grafana/scenes';
import { t } from 'app/core/internationalization';
import { QueryInspector } from 'app/features/inspector/QueryInspector';
import { InspectTab } from 'app/features/inspector/types';
import { getQueryRunnerFor } from '../utils/utils';
export class InspectQueryTab extends SceneObjectBase {
    constructor() {
        super(...arguments);
        this.onRefreshQuery = () => {
            const queryRunner = getQueryRunnerFor(this.state.panelRef.resolve());
            if (queryRunner) {
                queryRunner.runQueries();
            }
        };
    }
    getTabLabel() {
        return t('dashboard.inspect.query-tab', 'Query');
    }
    getTabValue() {
        return InspectTab.Query;
    }
}
InspectQueryTab.Component = ({ model }) => {
    const data = sceneGraph.getData(model.state.panelRef.resolve()).useState();
    if (!data.data) {
        return null;
    }
    return React.createElement(QueryInspector, { data: data.data, onRefreshQuery: model.onRefreshQuery });
};
//# sourceMappingURL=InspectQueryTab.js.map