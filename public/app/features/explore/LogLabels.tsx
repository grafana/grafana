import React, { PureComponent } from 'react';

import { LogRowModel } from 'app/core/logs_model';
import { LogLabel } from './LogLabel';
import { Labels } from '@grafana/ui';

interface Props {
  getRows?: () => LogRowModel[];
  labels: Labels;
  plain?: boolean;
  onClickLabel?: (label: string, value: string) => void;
}

export class LogLabels extends PureComponent<Props> {
  render() {
    const { getRows, labels, onClickLabel, plain } = this.props;
    return (
      <span className="logs-labels">
        {Object.keys(labels).map(key => (
          <LogLabel
            key={key}
            getRows={getRows}
            label={key}
            value={labels[key]}
            plain={plain}
            onClickLabel={onClickLabel}
          />
        ))}
      </span>
    );
  }
}
