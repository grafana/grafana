import React, { FC } from 'react';
import { SelectableValue } from '@grafana/data';
import { Button, Icon, InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';
import alertDef from '../../alerting/state/alertDef';
import { ExpressionQuery } from '../types';

const conditionFunctions = alertDef.reducerTypes.map((rt) => ({ label: rt.text, value: rt.value }));

interface Props {
  query: ExpressionQuery;
  refIds: Array<SelectableValue<string>>;
}

export const ClassicConditions: FC<Props> = ({ query, refIds }) => {
  return (
    <div>
      <InlineFieldRow>
        <InlineField label="Conditions">
          <div>
            {query.conditions?.map((condition, index) => {
              return (
                <InlineFieldRow key={index}>
                  {index === 0 ? (
                    <InlineField label="WHEN">
                      <Select onChange={(event) => console.log(event)} options={conditionFunctions} width={20} />
                    </InlineField>
                  ) : (
                    <InlineField label="WHEN">
                      <Select onChange={(event) => console.log(event)} options={conditionFunctions} width={20} />
                    </InlineField>
                  )}
                  <InlineField label="OF">
                    <Select onChange={(event) => console.log(event)} options={refIds} />
                  </InlineField>
                  <InlineField label="IS ABOVE">
                    <Input />
                  </InlineField>
                </InlineFieldRow>
              );
            })}
          </div>
        </InlineField>
      </InlineFieldRow>
      <Button variant="secondary">
        <Icon name="plus-circle" />
      </Button>
    </div>
  );
};
