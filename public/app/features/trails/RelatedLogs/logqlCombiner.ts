import { TreeCursor } from '@lezer/common';

import { parser } from '@grafana/lezer-logql';

interface LabelMatcher {
  label: string;
  op: string;
  value: string;
}

/**
 * A utility class for combining multiple LogQL queries into a single query.
 * This class handles the parsing and combination of label matchers from multiple LogQL queries.
 *
 * @class LogQLCombiner
 * @example
 * ```typescript
 * const combiner = new LogQLCombiner();
 * const queries = ['{app="frontend"}', '{app="backend"}'];
 * const combined = combiner.combineQueries(queries);
 * // Result: '{app=~"frontend|backend"}'
 * ```
 */
export class LogQLCombiner {
  private extractLabelMatchers(query: string): LabelMatcher[] {
    const tree = parser.parse(query);
    const matchers: LabelMatcher[] = [];

    const walkTree = (cursor: TreeCursor) => {
      const visit = () => {
        // Looking for Matcher nodes based on the LogQL grammar
        if (cursor.type.name === 'Matcher') {
          let label = '';
          let op = '';
          let value = '';

          // The Matcher rule in LogQL grammar shows: Identifier !eql (Eq|Neq|Re|Nre) String
          if (cursor.firstChild()) {
            let node = cursor.node;
            // First child should be Identifier
            if (node.type.name === 'Identifier') {
              label = query.slice(node.from, node.to);
            }

            // Move to operator
            if (cursor.nextSibling()) {
              node = cursor.node;
              // Could be Eq, Neq, Re, or Nre
              op = query.slice(node.from, node.to);

              // Move to String
              if (cursor.nextSibling()) {
                node = cursor.node;
                if (node.type.name === 'String') {
                  // Remove the quotes from the string value
                  value = query.slice(node.from + 1, node.to - 1);
                }
              }
            }
            cursor.parent();
          }

          if (label && op && value) {
            matchers.push({ label, op, value });
          }
        }

        // Recursively visit children
        if (cursor.firstChild()) {
          do {
            visit();
          } while (cursor.nextSibling());
          cursor.parent();
        }
      };

      visit();
    };

    walkTree(tree.cursor());
    return matchers;
  }

  private combineRegexValues(values: string[]): string {
    // Remove any existing regex anchors
    const cleanValues = values.map((v) => {
      // Remove surrounding quotes if present
      return v.replace(/^["']|["']$/g, '');
    });

    return cleanValues.join('|');
  }

  public combineQueries(queries: string[]): string {
    const allMatchers = new Map<string, Set<string>>();

    // Extract and group all matchers by label
    queries.forEach((query) => {
      const matchers = this.extractLabelMatchers(query);

      matchers.forEach(({ label, op, value }) => {
        if (!allMatchers.has(label)) {
          allMatchers.set(label, new Set());
        }
        allMatchers.get(label)!.add(`${op}"${value}"`);
      });
    });

    // Combine matchers into a single query
    const combinedMatchers = Array.from(allMatchers.entries()).map(([label, ops]) => {
      const opValues = Array.from(ops);
      if (opValues.length === 1) {
        return `${label}${opValues[0]}`;
      }

      // If we have multiple values, combine them into a regex matcher
      const values = opValues
        .map((op) => {
          // Extract the actual value from the operator+value string
          const match = op.match(/^(=~|=|!=|!~)"(.+)"$/);
          if (!match) {
            return '';
          }
          const [_, _operator, value] = match;
          return value;
        })
        .filter(Boolean);

      return `${label}=~"${this.combineRegexValues(values)}"`;
    });

    return `{${combinedMatchers.join(', ')}}`;
  }
}
