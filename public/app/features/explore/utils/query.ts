import { DataQuery, AbstractQuery, AbstractLabelOperator, AbstractLabelMatcher } from '@grafana/data';
import { Token } from 'prismjs';

const FromPromLikeMap: Record<string, AbstractLabelOperator> = {
  '=': AbstractLabelOperator.Equal,
  '!=': AbstractLabelOperator.NotEqual,
  '=~': AbstractLabelOperator.EqualRegEx,
  '!~': AbstractLabelOperator.NotEqualRegEx,
};
const ToPromLikeMap: Record<AbstractLabelOperator, string> = {
  [AbstractLabelOperator.Equal]: '=',
  [AbstractLabelOperator.NotEqual]: '!=',
  [AbstractLabelOperator.EqualRegEx]: '=~',
  [AbstractLabelOperator.NotEqualRegEx]: '!~',
};

export function toPromLikeQuery(labelBasedQuery: AbstractQuery): PromLikeQuery {
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

  return {
    refId: labelBasedQuery.refId,
    expr: expr ? `{${expr}}` : '',
    range: true,
  };
}

export interface PromLikeQuery extends DataQuery {
  expr: string;
  range: boolean;
}

export function extractLabelMatchers(tokens: Array<string | Token>): AbstractLabelMatcher[] {
  const labelMatchers: AbstractLabelMatcher[] = [];

  for (let prop in tokens) {
    if (tokens[prop] instanceof Token) {
      let token: Token = tokens[prop] as Token;
      if (token.type === 'context-labels') {
        let labelKey = '';
        let labelValue = '';
        let labelOperator = '';
        let contentTokens: any[] = token.content as any[];
        for (let currentToken in contentTokens) {
          if (typeof contentTokens[currentToken] === 'string') {
            let currentStr: string;
            currentStr = contentTokens[currentToken] as string;
            if (currentStr === '=' || currentStr === '!=' || currentStr === '=~' || currentStr === '!~') {
              labelOperator = currentStr;
            }
          } else if (contentTokens[currentToken] instanceof Token) {
            switch (contentTokens[currentToken].type) {
              case 'label-key':
                labelKey = contentTokens[currentToken].content as string;
                break;
              case 'label-value':
                labelValue = contentTokens[currentToken].content as string;
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
  }

  return labelMatchers;
}
