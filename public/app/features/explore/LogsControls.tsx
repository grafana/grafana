import React, { PureComponent } from 'react';

import { LogsDedupStrategy, LogRowModel } from '@grafana/data';
import { Field, RadioButtonGroup, Switch } from '@grafana/ui';
import { css, cx } from 'emotion';

export const fieldClass = css`
  gap: 12px;
  align-items: center;
`;

export const pushRight = css`
  margin-right: auto;
`;

interface Props {
  logRows?: LogRowModel[];
  showLabels: boolean;
  showTime: boolean;
  wrapLogMessage: boolean;
  dedupStrategy: LogsDedupStrategy;
  onDedupStrategyChange: (dedupStrategy: LogsDedupStrategy) => void;
  onLabelsChange: (showLabels: boolean) => void;
  onTimeChange: (showTime: boolean) => void;
  onWrapLogMessageChange: (wrapLogMessage: boolean) => void;
}

export class LogsControls extends PureComponent<Props> {
  onChangeDedup = (dedup: LogsDedupStrategy) => {
    return this.props.onDedupStrategyChange(dedup);
  };

  onChangeLabels = (event?: React.SyntheticEvent) => {
    const target = event && (event.target as HTMLInputElement);
    return this.props.onLabelsChange(target.checked);
  };

  onChangeTime = (event?: React.SyntheticEvent) => {
    const target = event && (event.target as HTMLInputElement);
    return this.props.onTimeChange(target.checked);
  };

  onChangewrapLogMessage = (event?: React.SyntheticEvent) => {
    const target = event && (event.target as HTMLInputElement);
    return this.props.onWrapLogMessageChange(target.checked);
  };

  render() {
    const { logRows, showTime, showLabels, dedupStrategy, wrapLogMessage } = this.props;

    if (!logRows) {
      return null;
    }

    return (
      <>
        <Field label="Time" horizontal className={cx(fieldClass)}>
          <Switch value={showTime} onChange={this.onChangeTime} />
        </Field>
        <Field label="Unique labels" horizontal className={cx(fieldClass)}>
          <Switch value={showLabels} onChange={this.onChangeLabels} />
        </Field>
        <Field label="Wrap lines" horizontal className={cx(fieldClass)}>
          <Switch value={wrapLogMessage} onChange={this.onChangewrapLogMessage} />
        </Field>
        <Field label="Dedup" horizontal className={cx(fieldClass, pushRight)}>
          <RadioButtonGroup
            options={Object.keys(LogsDedupStrategy).map((dedupType: string) => ({
              label: dedupType,
              value: dedupType,
            }))}
            value={dedupStrategy}
            onChange={this.onChangeDedup}
          />
        </Field>
      </>
    );
  }
}
