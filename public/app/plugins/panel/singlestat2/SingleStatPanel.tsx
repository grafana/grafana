// Libraries
import React from 'react';

// Types
import { SingleStatOptions } from './types';
import { DisplayValue } from '@grafana/ui/src/utils/displayValue';
import { SingleStatBase } from './SingleStatBase';

export class SingleStatPanel extends SingleStatBase<SingleStatOptions> {
  renderStat(value: DisplayValue, width: number, height: number) {
    return (
      <div style={{ width, height }}>
        <b>{value.text}</b>
      </div>
    );
  }
}
