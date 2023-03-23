import { SyntaxNode } from '@lezer/common';

import { ScopedVars } from '@grafana/data';
import { parser } from '@grafana/lezer-logql';
import { ErrorId } from 'app/plugins/datasource/prometheus/querybuilder/shared/parsingUtils';

import { placeHolderScopedVars } from './components/monaco-query-field/monaco-completion-provider/validation';

type Transformation = {
  original: string;
  replaced: string;
  nodeId: number;
};

type TransformedQuery = {
  transformations: Transformation[];
  query: string;
};

interface ParseError {
  text: string;
  node: SyntaxNode;
}

// 1. We compile a map of parse errors. Lezer sees variables as parse errors
function parseQuery(query: string) {
  const parseErrors = new Map<SyntaxNode | null, ParseError[]>();
  const tree = parser.parse(query);
  tree.iterate({
    enter: (nodeRef): false | void => {
      if (nodeRef.type.id === ErrorId) {
        const node = nodeRef.node;
        const siblings = parseErrors.get(node.parent) || [];
        parseErrors.set(node.parent, [
          ...siblings,
          {
            node,
            text: query.substring(node.from, node.to),
          },
        ]);
      }
    },
  });
  return parseErrors;
}

export function transformForFormatting(
  query: string,
  interpolateString: (string: string, scopedVars?: ScopedVars) => string
): TransformedQuery {
  // We get the possible variables from the parse errors
  const errors = parseQuery(query);
  // Nothing to fix, the query is ready for formatting
  if (!errors.size) {
    return {
      transformations: [],
      query,
    };
  }

  // 2. We walk through the parse errors and keep the ones that look like variables.
  const transformations: Transformation[] = [];
  errors.forEach((parseError, parent) => {
    if (parseError[0].text === '$' && parent) {
      let original = query.substring(parseError[0].node.from, parseError[parseError.length - 1].node.to);
      let replaced = interpolateString(original, placeHolderScopedVars);

      // Some node errors include non variable characters at the end, this removes them.
      // {job=$variable}             -> Error: $variable}   -> $variable
      // rate({job=$variable}[$var]) -> Error: $variable}[$ -> $variable
      original = original.replace(/[^\w\"]+$/, '');
      replaced = replaced.replace(/[^\w\"]+$/, '');

      // 3. If it cannot be interpolated, we ignore.
      if (original === replaced) {
        return;
      }

      // 4. We record a transformation from original to replaced and the node where it happened
      transformations.push({
        original,
        replaced,
        nodeId: parent.type.id,
      });
    }
  });

  // 5. We do a string replacement of every original with replaced
  let interpolatedQuery = query;
  transformations.forEach((transformation) => {
    interpolatedQuery = interpolatedQuery.replace(transformation.original, transformation.replaced);
  });

  return {
    transformations,
    query: interpolatedQuery,
  };
}

export function revertTransformations(query: string, transformations: Transformation[]): string {
  // Avoid unnecessary work
  if (!transformations.length) {
    return query;
  }

  // 6. We parse the formatted query again
  const tree = parser.parse(query);
  let recoveredQuery = query;

  tree.iterate({
    enter: (node): void => {
      if (transformations.some((transformation) => transformation.nodeId === node.type.id)) {
        const foundIndex = transformations.findIndex((transformation) => transformation.nodeId === node.type.id);
        const foundTransformation = transformations.splice(foundIndex, 1)[0];
        recoveredQuery = recoveredQuery.replace(foundTransformation.replaced, foundTransformation.original);
      }
    },
  });

  return recoveredQuery;
}
