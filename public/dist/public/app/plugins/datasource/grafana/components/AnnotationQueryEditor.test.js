import React from 'react';
import { render, screen } from '@testing-library/react';
import { GrafanaAnnotationType, GrafanaQueryType } from '../types';
import AnnotationQueryEditor from './AnnotationQueryEditor';
describe('AnnotationQueryEditor', function () {
    var mockOnChange = jest.fn();
    var mockQuery;
    beforeEach(function () {
        mockQuery = {
            queryType: GrafanaQueryType.Annotations,
            refId: 'Anno',
            type: GrafanaAnnotationType.Tags,
            limit: 100,
        };
    });
    it('has a "Filter by" input', function () {
        render(React.createElement(AnnotationQueryEditor, { query: mockQuery, onChange: mockOnChange }));
        var filterBy = screen.getByLabelText('Filter by');
        expect(filterBy).toBeInTheDocument();
    });
    it('has a "Max limit" input', function () {
        render(React.createElement(AnnotationQueryEditor, { query: mockQuery, onChange: mockOnChange }));
        var maxLimit = screen.getByLabelText('Max limit');
        expect(maxLimit).toBeInTheDocument();
    });
    describe('when the query type is "Tags" and the tags array is present', function () {
        beforeEach(function () {
            mockQuery.tags = [];
        });
        it('has a "Match any" toggle', function () {
            render(React.createElement(AnnotationQueryEditor, { query: mockQuery, onChange: mockOnChange }));
            var matchAny = screen.getByLabelText(/Match any/);
            expect(matchAny).toBeInTheDocument();
        });
        it('has a "Tags" input', function () {
            render(React.createElement(AnnotationQueryEditor, { query: mockQuery, onChange: mockOnChange }));
            var tags = screen.getByLabelText(/Tags/);
            expect(tags).toBeInTheDocument();
        });
    });
    describe('when the query type is "Dashboard"', function () {
        beforeEach(function () {
            mockQuery.type = GrafanaAnnotationType.Dashboard;
        });
        it('does not have a "Match any" toggle', function () {
            render(React.createElement(AnnotationQueryEditor, { query: mockQuery, onChange: mockOnChange }));
            var matchAny = screen.queryByLabelText('Match any');
            expect(matchAny).toBeNull();
        });
        it('does not have a "Tags" input', function () {
            render(React.createElement(AnnotationQueryEditor, { query: mockQuery, onChange: mockOnChange }));
            var tags = screen.queryByLabelText('Tags');
            expect(tags).toBeNull();
        });
    });
});
//# sourceMappingURL=AnnotationQueryEditor.test.js.map