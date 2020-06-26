import React, { PureComponent } from 'react';
import { ValueMapping, RangeMap } from '@grafana/data';
import { Input } from '../Input/Input';

interface RangeMapProps {
  dragClass: string;
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
    const { dragClass, mapping } = this.props;
    return (
      <>
        <div className="gf-form-label width-4">
          <i className={dragClass} />
          RANGE
        </div>
        <Input
          width={9}
          type="number"
          defaultValue={mapping.from || ''}
          placeholder={`From`}
          onBlur={this.onFromChanged}
        />
        <div className="gf-form-label">TO</div>
        <Input
          width={9}
          type="number"
          defaultValue={mapping.to || ''} // TO (comment for formatting)
          placeholder={`To`}
          onBlur={this.onToChanged}
        />
      </>
    );
  }
}
