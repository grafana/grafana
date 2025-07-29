import { invert } from 'lodash';
import Prism, { Grammar, Token } from 'prismjs';

import {
  AbstractLabelMatcher,
  AbstractLabelOperator,
  DataFrame,
  DataQueryResponse,
  DataQueryRequest,
} from '@grafana/data';

import { GrafanaPyroscopeDataQuery } from './dataquery.gen';

export function extractLabelMatchers(tokens: Array<string | Token>): AbstractLabelMatcher[] {
  const labelMatchers: AbstractLabelMatcher[] = [];

  for (const token of tokens) {
    if (!(token instanceof Token)) {
      continue;
    }

    if (token.type === 'context-labels') {
      let labelKey = '';
      let labelValue = '';
      let labelOperator = '';

      const contentTokens = Array.isArray(token.content) ? token.content : [token.content];

      for (let currentToken of contentTokens) {
        if (typeof currentToken === 'string') {
          let currentStr: string;
          currentStr = currentToken;
          if (currentStr === '=' || currentStr === '!=' || currentStr === '=~' || currentStr === '!~') {
            labelOperator = currentStr;
          }
        } else if (currentToken instanceof Token) {
          switch (currentToken.type) {
            case 'label-key':
              labelKey = getMaybeTokenStringContent(currentToken);
              break;
            case 'label-value':
              labelValue = getMaybeTokenStringContent(currentToken);
              labelValue = labelValue.substring(1, labelValue.length - 1);
              const labelComparator = FromPromLikeMap[labelOperator];
              if (labelComparator) {
                labelMatchers.push({ name: labelKey, operator: labelComparator, value: labelValue });
              }
              break;
          }
        }
      }
    }
  }

  return labelMatchers;
}

export function toPromLikeExpr(labelMatchers: AbstractLabelMatcher[]): string {
  const expr = labelMatchers
    .map((selector: AbstractLabelMatcher) => {
      const operator = ToPromLikeMap[selector.operator];
      if (operator) {
        return `${selector.name}${operator}"${selector.value}"`;
      } else {
        return '';
      }
    })
    .filter((e: string) => e !== '')
    .join(', ');

  return expr ? `{${expr}}` : '';
}

function getMaybeTokenStringContent(token: Token): string {
  if (typeof token.content === 'string') {
    return token.content;
  }

  return '';
}

const FromPromLikeMap: Record<string, AbstractLabelOperator> = {
  '=': AbstractLabelOperator.Equal,
  '!=': AbstractLabelOperator.NotEqual,
  '=~': AbstractLabelOperator.EqualRegEx,
  '!~': AbstractLabelOperator.NotEqualRegEx,
};

const ToPromLikeMap: Record<AbstractLabelOperator, string> = invert(FromPromLikeMap) as Record<
  AbstractLabelOperator,
  string
>;

/**
 * Modifies query, adding a new label=value pair to it while preserving other parts of the query. This operates on a
 * string representation of the query which needs to be parsed and then rendered to string again.
 */
export function addLabelToQuery(query: string, key: string, value: string | number, operator = '='): string {
  if (!key || !value) {
    throw new Error('Need label to add to query.');
  }

  const tokens = Prism.tokenize(query, grammar);
  let labels = extractLabelMatchers(tokens);

  // If we already have such label in the query, remove it and we will replace it. If we didn't we would end up
  // with query like `a=b,a=c` which won't return anything. Replacing also seems more meaningful here than just
  // ignoring the filter and keeping the old value.
  labels = labels.filter((l) => l.name !== key);
  labels.push({
    name: key,
    value: value.toString(),
    operator: FromPromLikeMap[operator] ?? AbstractLabelOperator.Equal,
  });

  return toPromLikeExpr(labels);
}

export const grammar: Grammar = {
  'context-labels': {
    pattern: /\{[^}]*(?=}?)/,
    greedy: true,
    inside: {
      comment: {
        pattern: /#.*/,
      },
      'label-key': {
        pattern: /[a-zA-Z_]\w*(?=\s*(=|!=|=~|!~))/,
        alias: 'attr-name',
        greedy: true,
      },
      'label-value': {
        pattern: /"(?:\\.|[^\\"])*"/,
        greedy: true,
        alias: 'attr-value',
      },
      punctuation: /[{]/,
    },
  },
  punctuation: /[{}(),.]/,
};

export function enrichDataFrameWithQueryContextMapper(
  request: DataQueryRequest<GrafanaPyroscopeDataQuery>,
  datasourceName: string
) {
  const validTargets = request.targets;
  return (response: DataQueryResponse) => {
    response.data = response.data.map((data: DataFrame) => {
      const query = validTargets.find((target) => target.refId === data.refId);
      if (!query || !query.datasource?.uid || !query.datasource?.type) {
        return data;
      }

      const context = {
        datasource: {
          uid: query.datasource.uid,
          type: query.datasource.type,
          name: datasourceName,
        },
        start: request.range.from.valueOf(),
        end: request.range.to.valueOf(),
        query,
      };

      data.meta = data.meta || {};
      data.meta.custom = {
        ...data.meta.custom,
        queryContext: context,
      };
      return data;
    });
    return response;
  };
}
