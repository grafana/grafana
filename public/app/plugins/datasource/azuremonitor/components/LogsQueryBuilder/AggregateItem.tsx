import React, { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { InputGroup, AccessoryButton } from '@grafana/plugin-ui';
import { Label, Select } from '@grafana/ui';

import { BuilderQueryEditorPropertyType, BuilderQueryEditorReduceExpression } from '../../dataquery.gen';

interface AggregateItemProps {
  aggregate: Partial<BuilderQueryEditorReduceExpression>;
  columns: Array<SelectableValue<string>>;
  onChange: (item: BuilderQueryEditorReduceExpression) => void;
  onDelete: () => void;
}

const AggregateItem: React.FC<AggregateItemProps> = (props) => {
  const { aggregate, onChange, onDelete, columns } = props;

  const availableAggregates = useMemo(() => {
    return [
      { label: 'sum', value: 'sum' },
      { label: 'avg', value: 'avg' },
      { label: 'min', value: 'min' },
      { label: 'max', value: 'max' },
      { label: 'percentile', value: 'percentile' },
      { label: 'count', value: 'count' },
      { label: 'dcount', value: 'dcount' },
    ];
  }, []);

  return (
    <InputGroup>
      <Select
        aria-label="aggregate function"
        width="auto"
        value={aggregate.reduce?.name ? { label: aggregate.reduce?.name, value: aggregate.reduce?.name } : null}
        options={availableAggregates}
        onChange={(e) => {
          const newAggregate = e.value;
          onChange({
            ...aggregate,
            reduce: {
              name: newAggregate || '',
              type: BuilderQueryEditorPropertyType.Function,
            },
            property: {
              name: aggregate.property?.name || '',
              type: aggregate.property?.type || BuilderQueryEditorPropertyType.String,
            },
          });
        }}
      />
      <Label style={{ margin: '9px 9px 0 9px' }}>OF</Label>
      <Select
        aria-label="column"
        width="auto"
        value={aggregate.property?.name ? { label: aggregate.property?.name, value: aggregate.property?.name } : null}
        options={columns}
        onChange={(e) => {
          const newColumn = e.value;
          onChange({
            ...aggregate,
            property: {
              name: newColumn || '',
              type: aggregate.property?.type || BuilderQueryEditorPropertyType.String,
            },
            reduce: aggregate.reduce || { name: '', type: BuilderQueryEditorPropertyType.Function },
          });
        }}
      />
      <AccessoryButton aria-label="remove" icon="times" variant="secondary" onClick={onDelete} />
    </InputGroup>
  );
};

export default AggregateItem;
