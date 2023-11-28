import { __awaiter } from "tslib";
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { setDataSourceSrv } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';
import { QueryRows } from './QueryRows';
import { makeExplorePaneState } from './state/utils';
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { reportInteraction: () => null })));
function setup(queries) {
    const defaultDs = {
        name: 'newDs',
        uid: 'newDs-uid',
        meta: { id: 'newDs' },
    };
    const datasources = {
        'newDs-uid': defaultDs,
        'someDs-uid': {
            name: 'someDs',
            uid: 'someDs-uid',
            meta: { id: 'someDs' },
            components: {
                QueryEditor: () => 'someDs query editor',
            },
        },
    };
    setDataSourceSrv({
        getList() {
            return Object.values(datasources).map((d) => ({ name: d.name }));
        },
        getInstanceSettings(uid) {
            return datasources[uid] || defaultDs;
        },
        get(uid) {
            return Promise.resolve(uid ? datasources[uid] || defaultDs : defaultDs);
        },
    });
    const leftState = makeExplorePaneState();
    const initialState = {
        panes: {
            left: Object.assign(Object.assign({}, leftState), { richHistory: [], datasourceInstance: datasources['someDs-uid'], queries, correlations: [] }),
        },
        correlationEditorDetails: { editorMode: false, dirty: false, isExiting: false },
        syncedTimes: false,
        richHistoryStorageFull: false,
        richHistoryLimitExceededWarningShown: false,
    };
    const store = configureStore({ explore: initialState, user: { orgId: 1 } });
    return {
        store,
        datasources,
    };
}
describe('Explore QueryRows', () => {
    it('Should duplicate a query and generate a valid refId', () => __awaiter(void 0, void 0, void 0, function* () {
        const { store } = setup([{ refId: 'A' }]);
        render(React.createElement(Provider, { store: store },
            React.createElement(QueryRows, { exploreId: 'left' })));
        // waiting for the d&d component to fully render.
        yield screen.findAllByText('someDs query editor');
        let duplicateButton = screen.getByLabelText(/Duplicate query/i);
        fireEvent.click(duplicateButton);
        // We should have another row with refId B
        expect(yield screen.findByLabelText('Query editor row title B')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=QueryRows.test.js.map