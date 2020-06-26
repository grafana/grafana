import React, { PureComponent } from 'react';
import { ValueMapping, ValueMap } from '@grafana/data';
import { Input } from '../Input/Input';

interface ValueMapProps {
  dragClass: string;
  mapping: ValueMap;
  index: number;
  onChange: (index: number, mapping: ValueMapping) => void;
}

export class ValueMapRow extends PureComponent<ValueMapProps> {
  constructor(props: ValueMapProps) {
    super(props);
  }

  onValueChanged = (event: React.FormEvent<HTMLInputElement>) => {
    const { index, mapping, onChange } = this.props;
    onChange(index, {
      ...mapping,
      value: event.currentTarget.value,
    });
  };

  render() {
    const { mapping, dragClass } = this.props;

    return (
      <>
        <div className="gf-form-label width-4">
          <i className={dragClass} />
          VALUE
        </div>

        <Input
          width={21}
          defaultValue={mapping.value || ''}
          placeholder={`Value`}
          onBlur={event => {
            const { index, mapping, onChange } = this.props;
            const txt = event.currentTarget.value;
            onChange(index, { ...mapping, value: txt });
          }}
        />
      </>
    );
  }
}
