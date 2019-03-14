// Libraries
import React, { CSSProperties } from 'react';

// Types
import { SingleStatOptions } from './types';
import { DisplayValue } from '@grafana/ui/src/utils/displayValue';
import { SingleStatBase } from './SingleStatBase';

export class SingleStatPanel extends SingleStatBase<SingleStatOptions> {
  renderStat(value: DisplayValue, width: number, height: number) {
    const style: CSSProperties = {};
    style.margin = '0 auto';
    style.fontSize = '250%';
    style.textAlign = 'center';
    if (value.color) {
      style.color = value.color;
    }

    return (
      <div style={{ width, height }}>
        <div style={style}>{value.text}</div>
      </div>
    );
  }
}
