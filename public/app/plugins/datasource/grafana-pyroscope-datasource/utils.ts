import { invert } from 'lodash';
import { Token } from 'prismjs';

import { AbstractLabelMatcher, AbstractLabelOperator, AbstractQuery } from '@grafana/data';

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

export function toPromLikeExpr(labelBasedQuery: AbstractQuery): string {
  const expr = labelBasedQuery.labelMatchers
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
