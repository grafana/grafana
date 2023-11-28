import { __awaiter } from "tslib";
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { config } from '@grafana/runtime';
import { makeVariable } from '../utils/testHelpers';
import { DatasetSelector } from './DatasetSelector';
import { buildMockDatasetSelectorProps, buildMockTableSelectorProps } from './SqlComponents.testHelpers';
import { TableSelector } from './TableSelector';
import { removeQuotesForMultiVariables } from './visual-query-builder/SQLWhereRow';
beforeEach(() => {
    config.featureToggles.sqlDatasourceDatabaseSelection = true;
});
afterEach(() => {
    config.featureToggles.sqlDatasourceDatabaseSelection = false;
});
describe('DatasetSelector', () => {
    it('should only query the database when needed', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockProps = buildMockDatasetSelectorProps();
        render(React.createElement(DatasetSelector, Object.assign({}, mockProps)));
        yield waitFor(() => {
            expect(mockProps.db.datasets).toHaveBeenCalled();
        });
    }));
    it('should not query the database if Postgres instance, and no preconfigured database', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockProps = buildMockDatasetSelectorProps({ isPostgresInstance: true });
        render(React.createElement(DatasetSelector, Object.assign({}, mockProps)));
        yield waitFor(() => {
            expect(mockProps.db.datasets).not.toHaveBeenCalled();
        });
    }));
    it('should not query the database if preconfigured', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockProps = buildMockDatasetSelectorProps({ preconfiguredDataset: 'database 1' });
        render(React.createElement(DatasetSelector, Object.assign({}, mockProps)));
        yield waitFor(() => {
            expect(mockProps.db.datasets).not.toHaveBeenCalled();
        });
    }));
});
describe('TableSelector', () => {
    it('should only query the database when needed', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockProps = buildMockTableSelectorProps({ dataset: 'database 1' });
        render(React.createElement(TableSelector, Object.assign({}, mockProps)));
        yield waitFor(() => {
            expect(mockProps.db.tables).toHaveBeenCalled();
        });
    }));
    it('should not query the database if no dataset is passed as a prop', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockProps = buildMockTableSelectorProps();
        render(React.createElement(TableSelector, Object.assign({}, mockProps)));
        yield waitFor(() => {
            expect(mockProps.db.tables).not.toHaveBeenCalled();
        });
    }));
});
describe('SQLWhereRow', () => {
    it('should remove quotes in a where clause including multi-value variable', () => {
        const exp = {
            whereString: "hostname IN ('${multiHost}')",
        };
        const multiVar = makeVariable('multiVar', 'multiHost', { multi: true });
        const nonMultiVar = makeVariable('nonMultiVar', 'host', { multi: false });
        const variables = [multiVar, nonMultiVar];
        removeQuotesForMultiVariables(exp, variables);
        expect(exp.whereString).toBe('hostname IN (${multiHost})');
    });
    it('should not remove quotes in a where clause including a non-multi variable', () => {
        const exp = {
            whereString: "hostname IN ('${host}')",
        };
        const multiVar = makeVariable('multiVar', 'multiHost', { multi: true });
        const nonMultiVar = makeVariable('nonMultiVar', 'host', { multi: false });
        const variables = [multiVar, nonMultiVar];
        removeQuotesForMultiVariables(exp, variables);
        expect(exp.whereString).toBe("hostname IN ('${host}')");
    });
    it('should not remove quotes in a where clause not including any known variables', () => {
        const exp = {
            whereString: "hostname IN ('${nonMultiHost}')",
        };
        const multiVar = makeVariable('multiVar', 'multiHost', { multi: true });
        const nonMultiVar = makeVariable('nonMultiVar', 'host', { multi: false });
        const variables = [multiVar, nonMultiVar];
        removeQuotesForMultiVariables(exp, variables);
        expect(exp.whereString).toBe("hostname IN ('${nonMultiHost}')");
    });
});
//# sourceMappingURL=SqlComponents.test.js.map