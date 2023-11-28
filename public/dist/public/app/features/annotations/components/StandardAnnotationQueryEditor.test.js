import { render } from '@testing-library/react';
import React from 'react';
import StandardAnnotationQueryEditor from './StandardAnnotationQueryEditor';
const setup = (customProps) => {
    const props = Object.assign({ datasource: {}, datasourceInstanceSettings: {}, annotation: {}, onChange: jest.fn() }, customProps);
    const { rerender } = render(React.createElement(StandardAnnotationQueryEditor, Object.assign({}, props)));
    return { rerender, props };
};
jest.mock('app/features/dashboard/services/DashboardSrv', () => ({
    getDashboardSrv: jest.fn().mockReturnValue({
        getCurrent: jest.fn().mockReturnValue(null),
    }),
}));
jest.mock('app/features/dashboard/services/TimeSrv', () => ({
    getTimeSrv: jest.fn().mockReturnValue({
        timeRange: jest.fn().mockReturnValue({}),
    }),
}));
describe('StandardAnnotationQueryEditor', () => {
    it('should fill out a default query if it is defined and pass it to the Query Editor', () => {
        var _a, _b, _c, _d;
        const { props } = setup({
            annotation: { name: 'initialAnn', target: { refId: 'initialAnnotationRef' } },
            datasource: {
                annotations: {
                    QueryEditor: jest.fn(() => React.createElement("div", null, "Editor")),
                    getDefaultQuery: jest.fn().mockImplementation(() => ({ queryType: 'defaultAnnotationsQuery' })),
                    prepareAnnotation: (annotation) => annotation,
                },
            },
        });
        expect((_b = (_a = props.datasource) === null || _a === void 0 ? void 0 : _a.annotations) === null || _b === void 0 ? void 0 : _b.getDefaultQuery).toBeDefined();
        expect((_d = (_c = props.datasource) === null || _c === void 0 ? void 0 : _c.annotations) === null || _d === void 0 ? void 0 : _d.QueryEditor).toHaveBeenCalledWith(expect.objectContaining({
            query: expect.objectContaining({ queryType: 'defaultAnnotationsQuery', refId: 'initialAnnotationRef' }),
        }), expect.anything());
    });
    it('should keep and pass the initial query if the defaultQuery is not defined', () => {
        var _a, _b;
        const { props } = setup({
            annotation: { name: 'initialAnn', target: { refId: 'initialAnnotationRef' } },
            datasource: {
                annotations: {
                    QueryEditor: jest.fn(() => React.createElement("div", null, "Editor")),
                    prepareAnnotation: (annotation) => annotation,
                },
            },
        });
        expect((_b = (_a = props.datasource) === null || _a === void 0 ? void 0 : _a.annotations) === null || _b === void 0 ? void 0 : _b.QueryEditor).toHaveBeenCalledWith(expect.objectContaining({
            query: expect.objectContaining({ refId: 'initialAnnotationRef' }),
        }), expect.anything());
    });
});
//# sourceMappingURL=StandardAnnotationQueryEditor.test.js.map