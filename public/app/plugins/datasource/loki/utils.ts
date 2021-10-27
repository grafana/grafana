import { DataQuery, AbstractQuery, AbstractLabelOperator, AbstractLabelMatcher } from '@grafana/data';
import Prism, { Token } from 'prismjs';
import grammar from '../prometheus/promql';

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
  };
}

export interface PromLikeQuery extends DataQuery {
  expr: string;
}

export function fromPromLikeQuery(query: PromLikeQuery): AbstractQuery {
  const labels: AbstractLabelMatcher[] = [];
  const promQuery = query.expr;
  if (!promQuery || promQuery.length === 0) {
    return { refId: query.refId, labelMatchers: labels };
  }
  const tokens = Prism.tokenize(promQuery, grammar);
  const nameLabelValue = getNameLabelValue(promQuery, tokens);
  if (nameLabelValue && nameLabelValue.length > 0) {
    labels.push({
      name: '__name__',
      operator: AbstractLabelOperator.Equal,
      value: nameLabelValue,
    });
  }

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
                  labels.push({ name: labelKey, operator: labelComparator, value: labelValue });
                }
                break;
            }
          }
        }
      }
    }
  }

  return {
    refId: query.refId,
    labelMatchers: labels,
  };
}

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

function getNameLabelValue(promQuery: string, tokens: any): string {
  let nameLabelValue = '';
  for (let prop in tokens) {
    if (typeof tokens[prop] === 'string') {
      nameLabelValue = tokens[prop] as string;
      break;
    }
  }
  return nameLabelValue;
}
