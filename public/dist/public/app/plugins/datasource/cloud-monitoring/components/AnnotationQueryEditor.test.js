import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { createMockDatasource } from '../__mocks__/cloudMonitoringDatasource';
import { createMockQuery } from '../__mocks__/cloudMonitoringQuery';
import { AnnotationQueryEditor } from './AnnotationQueryEditor';
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getTemplateSrv: () => ({
        replace: (val) => val,
    }) })));
describe('AnnotationQueryEditor', () => {
    it('renders correctly', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        const onRunQuery = jest.fn();
        const datasource = createMockDatasource();
        const query = createMockQuery();
        render(React.createElement(AnnotationQueryEditor, { onChange: onChange, onRunQuery: onRunQuery, query: query, datasource: datasource }));
        expect(yield screen.findByLabelText('Project')).toBeInTheDocument();
        expect(yield screen.findByLabelText('Service')).toBeInTheDocument();
        expect(yield screen.findByLabelText('Metric name')).toBeInTheDocument();
        expect(yield screen.findByLabelText('Group by')).toBeInTheDocument();
        expect(yield screen.findByLabelText('Group by function')).toBeInTheDocument();
        expect(yield screen.findByLabelText('Alignment function')).toBeInTheDocument();
        expect(yield screen.findByLabelText('Alignment period')).toBeInTheDocument();
        expect(yield screen.findByLabelText('Alias by')).toBeInTheDocument();
        expect(yield screen.findByLabelText('Title')).toBeInTheDocument();
        expect(yield screen.findByLabelText('Text')).toBeInTheDocument();
        expect(yield screen.findByText('Annotation Query Format')).toBeInTheDocument();
    }));
    it('can set the title', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        const onRunQuery = jest.fn();
        const datasource = createMockDatasource();
        const query = createMockQuery();
        render(React.createElement(AnnotationQueryEditor, { onChange: onChange, onRunQuery: onRunQuery, query: query, datasource: datasource }));
        const title = 'user-title';
        yield userEvent.type(screen.getByLabelText('Title'), title);
        expect(yield screen.findByDisplayValue(title)).toBeInTheDocument();
    }));
    it('can set the text', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        const onRunQuery = jest.fn();
        const datasource = createMockDatasource();
        const query = createMockQuery();
        render(React.createElement(AnnotationQueryEditor, { onChange: onChange, onRunQuery: onRunQuery, query: query, datasource: datasource }));
        const text = 'user-text';
        yield userEvent.type(screen.getByLabelText('Text'), text);
        expect(yield screen.findByDisplayValue(text)).toBeInTheDocument();
    }));
});
//# sourceMappingURL=AnnotationQueryEditor.test.js.map