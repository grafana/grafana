import { SyntaxNode } from '@lezer/common';

import {
  Aggregate,
  And,
  AttributeField,
  ComparisonOp,
  FieldExpression,
  FieldOp,
  IntrinsicField,
  Or,
  parser,
  Pipe,
  ScalarExpression,
  ScalarFilter,
  SpansetFilter,
  SpansetPipelineExpression,
} from '@grafana/lezer-traceql';
import { monacoTypes } from '@grafana/ui';

/**
 * Given an error node, generate an error message to be displayed to the user.
 *
 * @param errorNode the error node, as returned by the TraceQL Lezer parser
 * @returns the error message
 */
export const computeErrorMessage = (errorNode: SyntaxNode) => {
  switch (errorNode.parent?.type.id) {
    case FieldExpression:
      switch (errorNode.prevSibling?.type.id) {
        case And:
        case Or:
          return 'Invalid value after logical operator.';
        case FieldOp:
          return 'Invalid value after comparison or aritmetic operator.';
        default:
          return 'Invalid operator after field expression.';
      }
    case SpansetFilter:
      if (errorNode.prevSibling?.type.id === FieldExpression) {
        return 'Invalid comparison operator after field expression.';
      }
      return 'Invalid expression for spanset.';
    case SpansetPipelineExpression:
      switch (errorNode.prevSibling?.type.id) {
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
      switch (errorNode.prevSibling?.type.id) {
        case ComparisonOp:
          return 'Invalid value after comparison operator.';
        case ScalarExpression:
          if (errorNode.prevSibling?.firstChild?.type.id === Aggregate) {
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
export const getErrorNodes = (query: string): SyntaxNode[] => {
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
  const errorNodes: SyntaxNode[] = [];
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
export const setErrorMarkers = (
  monaco: typeof monacoTypes,
  model: monacoTypes.editor.ITextModel,
  errorNodes: SyntaxNode[]
) => {
  monaco.editor.setModelMarkers(
    model,
    'owner', // default value
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
    })
  );
};
