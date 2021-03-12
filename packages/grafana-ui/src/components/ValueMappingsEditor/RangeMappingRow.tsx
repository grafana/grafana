import React, { PureComponent } from 'react';
import { ValueMapping, RangeMap } from '@grafana/data';
import { Input } from '../Input/Input';
import { HorizontalGroup } from '../Layout/Layout';

interface RangeMapProps {
  mapping: RangeMap;
  index: number;
  onChange: (index: number, mapping: ValueMapping) => void;
}

export class RangeMapRow extends PureComponent<RangeMapProps> {
  constructor(props: RangeMapProps) {
    super(props);
  }

  // Make sure the text values are sorted before saving
  onChange = (mapping: RangeMap) => {
    let from: number = +mapping.from;
    let to: number = +mapping.to;
    if (from > to) {
      const tmp = to;
      to = from;
      from = tmp;
    }

    const copy = { ...mapping };
    copy.from = isNaN(from) ? '' : `${from}`;
    copy.to = isNaN(to) ? '' : `${to}`;
    this.props.onChange(this.props.index, copy);
  };

  onFromChanged = (event: React.FormEvent<HTMLInputElement>) => {
    this.onChange({
      ...this.props.mapping,
      from: event.currentTarget.value,
    });
  };

  onToChanged = (event: React.FormEvent<HTMLInputElement>) => {
    this.onChange({
      ...this.props.mapping,
      to: event.currentTarget.value,
    });
  };

  render() {
    const { mapping } = this.props;
    return (
      <HorizontalGroup spacing="xs" wrap>
        <Input
          type="number"
          defaultValue={mapping.from || ''}
          placeholder="Value"
          onBlur={this.onFromChanged}
          prefix="From"
          tabIndex={0}
          width={15}
        />
        <Input
          type="number"
          defaultValue={mapping.to || ''} // TO (comment for formatting)
          placeholder="Value"
          onBlur={this.onToChanged}
          prefix="To"
          tabIndex={1}
          width={15}
        />
      </HorizontalGroup>
    );
  }
}
