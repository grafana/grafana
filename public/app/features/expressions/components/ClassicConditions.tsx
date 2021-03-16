import React, { FC } from 'react';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';
import alertDef from '../../alerting/state/alertDef';
import { ExpressionQuery } from '../types';

const conditionFunctions = alertDef.reducerTypes;

interface Props {
  query: ExpressionQuery;
}

export const ClassicConditions: FC<Props> = ({ query }) => {
  return (
    <div>
      <InlineFieldRow>
        <InlineField label="Conditions">
          <div>
            {query.conditions?.map((condition, index) => {
              return (
                <InlineFieldRow label="When" key={index}>
                  <Select onChange={(event) => console.log(event)} options={conditionFunctions} />
                </InlineFieldRow>
              );
            })}
          </div>
        </InlineField>
      </InlineFieldRow>
    </div>
  );
};
