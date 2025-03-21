import { useState } from 'react';

import { EditorRow, EditorFieldGroup, EditorField } from '@grafana/plugin-ui';
import { Icon, Input, Tooltip } from '@grafana/ui';

interface LimitSectionProps {
  handleQueryLimitUpdate: (limit: number) => void;
}

export const LimitSection: React.FC<LimitSectionProps> = ({ handleQueryLimitUpdate }) => {
  const [limit, setLimit] = useState<number>();

  return (
    <EditorRow>
      <EditorFieldGroup>
        <EditorField label="Limit" optional={true}>
          <Input
            className="width-5"
            type="number"
            placeholder="Enter limit"
            value={limit ?? 1000}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const newValue = e.target.value.replace(/[^0-9]/g, '');
              setLimit(newValue ? Number(newValue) : undefined);
              handleQueryLimitUpdate(Number(newValue));
            }}
          />
        </EditorField>
        <Tooltip
          content={<>Restrict the number of rows returned (default is 1000).</>}
          placement="right"
          interactive={true}
        >
          <Icon name="info-circle" />
        </Tooltip>
      </EditorFieldGroup>
    </EditorRow>
  );
};
