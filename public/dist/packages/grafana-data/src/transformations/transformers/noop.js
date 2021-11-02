import { DataTransformerID } from './ids';
export var noopTransformer = {
    id: DataTransformerID.noop,
    name: 'noop',
    description: 'No-operation transformer',
    defaultOptions: {},
    /**
     * Return a modified copy of the series.  If the transform is not or should not
     * be applied, just return the input series
     */
    operator: function (options) { return function (source) { return source; }; },
};
//# sourceMappingURL=noop.js.map