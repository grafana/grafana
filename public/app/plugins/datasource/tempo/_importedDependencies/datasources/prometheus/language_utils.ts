import { invert } from 'lodash';
import { Token } from 'prismjs';

import { AbstractLabelOperator, AbstractLabelMatcher, AbstractQuery } from '@grafana/data';

export const SUGGESTIONS_LIMIT = 10000;

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

export function limitSuggestions(items: string[]) {
  return items.slice(0, SUGGESTIONS_LIMIT);
}

export function processLabels(labels: Array<{ [key: string]: string }>, withName = false) {
  // For processing we are going to use sets as they have significantly better performance than arrays
  // After we process labels, we will convert sets to arrays and return object with label values in arrays
  const valueSet: { [key: string]: Set<string> } = {};
  labels.forEach((label) => {
    const { __name__, ...rest } = label;
    if (withName) {
      valueSet['__name__'] = valueSet['__name__'] || new Set();
      if (!valueSet['__name__'].has(__name__)) {
        valueSet['__name__'].add(__name__);
      }
    }

    Object.keys(rest).forEach((key) => {
      if (!valueSet[key]) {
        valueSet[key] = new Set();
      }
      if (!valueSet[key].has(rest[key])) {
        valueSet[key].add(rest[key]);
      }
    });
  });

  // valueArray that we are going to return in the object
  const valueArray: { [key: string]: string[] } = {};
  limitSuggestions(Object.keys(valueSet)).forEach((key) => {
    valueArray[key] = limitSuggestions(Array.from(valueSet[key]));
  });

  return { values: valueArray, keys: Object.keys(valueArray) };
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
