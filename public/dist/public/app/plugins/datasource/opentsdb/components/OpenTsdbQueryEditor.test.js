import { render, screen } from '@testing-library/react';
import React from 'react';
import { OpenTsdbQueryEditor, testIds } from './OpenTsdbQueryEditor';
const setup = (propOverrides) => {
    const getAggregators = jest.fn().mockResolvedValue([]);
    const getFilterTypes = jest.fn().mockResolvedValue([]);
    const datasourceMock = {
        getAggregators,
        getFilterTypes,
        tsdbVersion: 1,
    };
    const datasource = datasourceMock;
    const onRunQuery = jest.fn();
    const onChange = jest.fn();
    const query = { metric: '', refId: 'A' };
    const props = {
        datasource: datasource,
        onRunQuery: onRunQuery,
        onChange: onChange,
        query,
    };
    Object.assign(props, propOverrides);
    return render(React.createElement(OpenTsdbQueryEditor, Object.assign({}, props)));
};
describe('OpenTsdbQueryEditor', () => {
    it('should render editor', () => {
        setup();
        expect(screen.getByTestId(testIds.editor)).toBeInTheDocument();
    });
});
//# sourceMappingURL=OpenTsdbQueryEditor.test.js.map