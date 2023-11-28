import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import { noop } from 'lodash';
import React from 'react';
import { CoreApp } from '@grafana/data';
import { createLokiDatasource } from '../mocks';
import { testIds as regularTestIds } from './LokiQueryEditor';
import { LokiQueryEditorByApp } from './LokiQueryEditorByApp';
import { testIds as alertingTestIds } from './LokiQueryEditorForAlerting';
function setup(app) {
    const dataSource = createLokiDatasource();
    dataSource.metadataRequest = jest.fn();
    return render(React.createElement(LokiQueryEditorByApp, { app: app, onChange: noop, onRunQuery: noop, datasource: dataSource, query: { refId: 'A', expr: '' } }));
}
describe('LokiQueryEditorByApp', () => {
    it('should render simplified query editor for cloud alerting', () => __awaiter(void 0, void 0, void 0, function* () {
        setup(CoreApp.CloudAlerting);
        expect(yield screen.findByTestId(alertingTestIds.editor)).toBeInTheDocument();
        expect(screen.queryByTestId(regularTestIds.editor)).toBeNull();
    }));
    it('should render regular query editor for unknown apps', () => __awaiter(void 0, void 0, void 0, function* () {
        setup(CoreApp.Unknown);
        expect(yield screen.findByTestId(regularTestIds.editor)).toBeInTheDocument();
        expect(screen.queryByTestId(alertingTestIds.editor)).toBeNull();
    }));
    it('should render regular query editor for explore', () => __awaiter(void 0, void 0, void 0, function* () {
        setup(CoreApp.Explore);
        expect(yield screen.findByTestId(regularTestIds.editor)).toBeInTheDocument();
        expect(screen.queryByTestId(alertingTestIds.editor)).toBeNull();
    }));
    it('should render regular query editor for dashboard', () => __awaiter(void 0, void 0, void 0, function* () {
        setup(CoreApp.Dashboard);
        expect(yield screen.findByTestId(regularTestIds.editor)).toBeInTheDocument();
        expect(screen.queryByTestId(alertingTestIds.editor)).toBeNull();
    }));
});
//# sourceMappingURL=LokiQueryEditorByApp.test.js.map