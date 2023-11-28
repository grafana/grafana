import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import { noop } from 'lodash';
import React from 'react';
import { CoreApp } from '@grafana/data';
import { PromQueryEditorByApp } from './PromQueryEditorByApp';
import { testIds as alertingTestIds } from './PromQueryEditorForAlerting';
// the monaco-based editor uses lazy-loading and that does not work
// well with this test, and we do not need the monaco-related
// functionality in this test anyway, so we mock it out.
jest.mock('./monaco-query-field/MonacoQueryFieldLazy', () => {
    const fakeQueryField = (props) => {
        return React.createElement("input", { onBlur: (e) => props.onBlur(e.currentTarget.value), "data-testid": 'dummy-code-input', type: 'text' });
    };
    return {
        MonacoQueryFieldLazy: fakeQueryField,
    };
});
function setup(app) {
    const dataSource = {
        createQuery: jest.fn((q) => q),
        getInitHints: () => [],
        getPrometheusTime: jest.fn((date, roundup) => 123),
        getQueryHints: jest.fn(() => []),
        getDebounceTimeInMilliseconds: jest.fn(() => 300),
        languageProvider: {
            start: () => Promise.resolve([]),
            syntax: () => { },
            getLabelKeys: () => [],
            metrics: [],
        },
    };
    const onRunQuery = jest.fn();
    render(React.createElement(PromQueryEditorByApp, { app: app, onChange: noop, onRunQuery: onRunQuery, datasource: dataSource, query: { refId: 'A', expr: '' } }));
    return {
        onRunQuery,
    };
}
describe('PromQueryEditorByApp', () => {
    it('should render simplified query editor for cloud alerting', () => __awaiter(void 0, void 0, void 0, function* () {
        setup(CoreApp.CloudAlerting);
        expect(yield screen.findByTestId(alertingTestIds.editor)).toBeInTheDocument();
    }));
    it('should render editor selector for unkown apps', () => {
        setup(CoreApp.Unknown);
        expect(screen.getByTestId('QueryEditorModeToggle')).toBeInTheDocument();
        expect(screen.queryByTestId(alertingTestIds.editor)).toBeNull();
    });
    it('should render editor selector for explore', () => {
        setup(CoreApp.Explore);
        expect(screen.getByTestId('QueryEditorModeToggle')).toBeInTheDocument();
        expect(screen.queryByTestId(alertingTestIds.editor)).toBeNull();
    });
    it('should render editor selector for dashboard', () => {
        setup(CoreApp.Dashboard);
        expect(screen.getByTestId('QueryEditorModeToggle')).toBeInTheDocument();
        expect(screen.queryByTestId(alertingTestIds.editor)).toBeNull();
    });
});
//# sourceMappingURL=PromQueryEditorByApp.test.js.map