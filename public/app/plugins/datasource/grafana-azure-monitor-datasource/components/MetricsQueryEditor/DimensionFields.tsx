import { Button, InlineField } from '@grafana/ui';
import React, { useState } from 'react';

interface DimensionFieldsProps {}

const DimensionFields: React.FC<DimensionFieldsProps> = () => {
  const [filters, setFilters] = useState<number[]>();

  return (
    <InlineField label="Dimension" labelWidth={16}>
      <div>
        {filters && filters.map((filter, index) => <div key={index}>filter {filter}</div>)}

        <Button
          variant="secondary"
          size="md"
          onClick={() => setFilters((v) => (v ? [...v, v[v.length - 1] + 1] : [0]))}
        >
          Add new dimension
        </Button>
      </div>
    </InlineField>
  );
};

export default DimensionFields;
