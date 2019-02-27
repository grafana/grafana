import React, { PureComponent } from 'react';

import { LogsStreamLabels, LogRowModel } from 'app/core/logs_model';
import { LogLabel } from './LogLabel';

interface Props {
  getRows?: () => LogRowModel[];
  labels: LogsStreamLabels;
  plain?: boolean;
  onClickLabel?: (label: string, value: string) => void;
}

export class LogLabels extends PureComponent<Props> {
  render() {
    const { getRows, labels, onClickLabel, plain } = this.props;
    return Object.keys(labels).map(key => (
      <LogLabel key={key} getRows={getRows} label={key} value={labels[key]} plain={plain} onClickLabel={onClickLabel} />
    ));
  }
}
