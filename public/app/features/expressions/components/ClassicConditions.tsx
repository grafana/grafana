import React, { FC } from 'react';
import { InlineField, InlineFieldRow } from '@grafana/ui';

export const ClassicConditions: FC = () => {
  return (
    <div>
      <InlineFieldRow>
        <InlineField label="Condition">
          <div>classic</div>
        </InlineField>
      </InlineFieldRow>
    </div>
  );
};
