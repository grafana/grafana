import { Aggregate, And, AttributeField, ComparisonOp, FieldExpression, FieldOp, IntrinsicField, Or, parser, Pipe, ScalarExpression, ScalarFilter, SpansetFilter, SpansetPipelineExpression, } from '@grafana/lezer-traceql';
/**
 * Given an error node, generate an error message to be displayed to the user.
 *
 * @param errorNode the error node, as returned by the TraceQL Lezer parser
 * @returns the error message
 */
export const computeErrorMessage = (errorNode) => {
    var _a, _b, _c, _d, _e, _f, _g;
    switch ((_a = errorNode.parent) === null || _a === void 0 ? void 0 : _a.type.id) {
        case FieldExpression:
            switch ((_b = errorNode.prevSibling) === null || _b === void 0 ? void 0 : _b.type.id) {
                case And:
                case Or:
                    return 'Invalid value after logical operator.';
                case FieldOp:
                    return 'Invalid value after comparison or aritmetic operator.';
                default:
                    return 'Invalid operator after field expression.';
            }
        case SpansetFilter:
            if (((_c = errorNode.prevSibling) === null || _c === void 0 ? void 0 : _c.type.id) === FieldExpression) {
                return 'Invalid comparison operator after field expression.';
            }
            return 'Invalid expression for spanset.';
        case SpansetPipelineExpression:
            switch ((_d = errorNode.prevSibling) === null || _d === void 0 ? void 0 : _d.type.id) {
                case SpansetPipelineExpression:
                    return 'Invalid spanset combining operator after spanset expression.';
                case Pipe:
                    return 'Invalid aggregation operator after pipepile operator.';
                default:
                    return 'Invalid spanset expression after spanset combining operator.';
            }
        case IntrinsicField:
        case Aggregate:
            return 'Invalid expression for aggregator operator.';
        case AttributeField:
            return 'Invalid expression for spanset.';
        case ScalarFilter:
            switch ((_e = errorNode.prevSibling) === null || _e === void 0 ? void 0 : _e.type.id) {
                case ComparisonOp:
                    return 'Invalid value after comparison operator.';
                case ScalarExpression:
                    if (((_g = (_f = errorNode.prevSibling) === null || _f === void 0 ? void 0 : _f.firstChild) === null || _g === void 0 ? void 0 : _g.type.id) === Aggregate) {
                        return 'Invalid comparison operator after aggregator operator.';
                    }
                default:
                    return 'Invalid value after comparison operator.';
            }
        default:
            return 'Invalid query.';
    }
};
/**
 * Parse the given query and find the error nodes, if any, in the resulting tree.
 *
 * @param query the TraceQL query of the user
 * @returns the error nodes
 */
export const getErrorNodes = (query) => {
    // Return immediately if the query is empty, to avoid raising exceptions in processing it
    if (query.trim() === '') {
        return [];
    }
    // Check whether this is a trace ID or traceQL query by checking if it only contains hex characters
    const hexOnlyRegex = /^[0-9A-Fa-f]*$/;
    if (query.trim().match(hexOnlyRegex)) {
        return [];
    }
    const tree = parser.parse(query);
    // Find all error nodes and compute the associated erro boundaries
    const errorNodes = [];
    tree.iterate({
        enter: (nodeRef) => {
            if (nodeRef.type.id === 0) {
                errorNodes.push(nodeRef.node);
            }
        },
    });
    return errorNodes;
};
/**
 * Use red markers (squiggles) to highlight syntax errors in queries.
 *
 */
export const setErrorMarkers = (monaco, model, errorNodes) => {
    monaco.editor.setModelMarkers(model, 'owner', // default value
    errorNodes.map((errorNode) => {
        let startLine = 0;
        let endLine = 0;
        let start = errorNode.from;
        let end = errorNode.to;
        while (start > 0) {
            startLine++;
            start -= model.getLineLength(startLine) + 1; // new lines don't count for getLineLength() but they still count as a character for the parser
        }
        while (end > 0) {
            endLine++;
            end -= model.getLineLength(endLine) + 1;
        }
        return {
            message: computeErrorMessage(errorNode),
            severity: monaco.MarkerSeverity.Error,
            startLineNumber: startLine,
            endLineNumber: endLine,
            // `+ 2` because of the above computations
            startColumn: start + model.getLineLength(startLine) + 2,
            endColumn: end + model.getLineLength(endLine) + 2,
        };
    }));
};
//# sourceMappingURL=errorHighlighting.js.map