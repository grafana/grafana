import { dateMath, dateTime, TimeRange } from '@grafana/data';

import { SceneComponentProps } from '../core/types';
import { SceneObjectStatePlain, SceneParametrizedState } from '../core/types';
import { SceneTimeRangeObject } from '../core/SceneObjectBase';
import React from 'react';
import { Field, Input } from '@grafana/ui';

type SceneTimeShiftParams = {
  range: SceneTimeRangeObject;
};

interface SceneTimeShiftNodeState extends SceneObjectStatePlain, SceneParametrizedState<SceneTimeShiftParams> {
  timeShift: string;
  range?: TimeRange;
}

export class SceneTimeShiftNode extends SceneTimeRangeObject<SceneTimeShiftNodeState> {
  static Component = SceneTimeShiftNodeRenderer;

  constructor(state: SceneTimeShiftNodeState) {
    super(state);

    this.setState({
      range: this.getShiftedTimeRange(state.inputParams.range.state.range!, state.timeShift),
    });
  }

  activate() {
    super.activate();
    this.subs.add(
      this.state.inputParams.range.subscribe({
        next: (next) => {
          this.setState({ range: this.getShiftedTimeRange(next.range!, this.state.timeShift) });
        },
      })
    );
  }

  onTimeShiftUpdate(shift: string) {
    this.setState({
      timeShift: shift,
      range: this.getShiftedTimeRange(this.state.inputParams.range.state.range!, shift),
    });
  }

  getShiftedTimeRange(range: TimeRange, shift: string): TimeRange {
    // nned to copy time range to avoid mutating original via dateMath.parseDateMath
    const oldFrom = dateTime(range.from);
    const oldTo = dateTime(range.to);

    const from = dateMath.parseDateMath(shift, oldFrom, false)!;
    const to = dateMath.parseDateMath(shift, oldTo, true)!;

    const next = {
      from,
      to,
      raw: {
        from,
        to,
      },
    };

    return next;
  }
}

interface SceneTimeShiftNodeRendererProps extends SceneComponentProps<SceneTimeShiftNode> {}

function SceneTimeShiftNodeRenderer({ model }: SceneTimeShiftNodeRendererProps) {
  const state = model.useState();
  return (
    <Field label="Time shift interval">
      <Input
        defaultValue={state.timeShift}
        width={8}
        onBlur={(evt) => {
          model.onTimeShiftUpdate(evt.currentTarget.value);
        }}
      />
    </Field>
  );
}
