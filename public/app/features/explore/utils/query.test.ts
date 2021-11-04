import { AbstractLabelOperator, AbstractQuery } from '@grafana/data';
import { toPromLikeQuery } from './query';

describe('toPromLikeQuery', () => {
  it('export abstract query to PromQL-like query', () => {
    const abstractQuery: AbstractQuery = {
      refId: 'bar',
      labelMatchers: [
        { name: 'label1', operator: AbstractLabelOperator.Equal, value: 'value1' },
        { name: 'label2', operator: AbstractLabelOperator.NotEqual, value: 'value2' },
        { name: 'label3', operator: AbstractLabelOperator.EqualRegEx, value: 'value3' },
        { name: 'label4', operator: AbstractLabelOperator.NotEqualRegEx, value: 'value4' },
      ],
    };

    expect(toPromLikeQuery(abstractQuery)).toMatchObject({
      refId: 'bar',
      expr: '{label1="value1", label2!="value2", label3=~"value3", label4!~"value4"}',
      range: true,
    });
  });
});
