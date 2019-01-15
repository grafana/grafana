import React, { PureComponent } from 'react';
// import tinycolor, { ColorInput } from 'tinycolor2';

import { Threshold, BasicGaugeColor } from '../../types';
import { ColorPicker } from '../ColorPicker/ColorPicker';
import { PanelOptionsGroup } from '../PanelOptionsGroup/PanelOptionsGroup';
import { colors } from '../../utils';

export interface Props {
  thresholds: Threshold[];
  onChange: (thresholds: Threshold[]) => void;
}

interface State {
  thresholds: Threshold[];
  baseColor: string;
}

export class ThresholdsEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    const thresholds: Threshold[] =
      props.thresholds.length > 0 ? props.thresholds : [{ index: 0, value: -Infinity, color: '#299c46' }];
    this.state = { thresholds, baseColor: BasicGaugeColor.Green };
  }

  onAddThreshold = (index: number) => {
    const { thresholds } = this.state;
    const maxValue = 100;
    const minValue = 0;

    if (index === 0) {
      return;
    }

    const newThresholds = thresholds.map(threshold => {
      if (threshold.index >= index) {
        const index = threshold.index + 1;
        threshold = { ...threshold, index, color: colors[index] };
      }
      return threshold;
    });

    // Setting value to a value between the previous thresholds
    const beforeThreshold = newThresholds.filter(threshold => threshold.index === index - 1)[0];
    const afterThreshold = newThresholds.filter(threshold => threshold.index === index + 1)[0];
    const beforeThresholdValue = beforeThreshold !== undefined ? Math.max(beforeThreshold.value, minValue) : minValue;
    const afterThresholdValue = afterThreshold !== undefined ? Math.min(afterThreshold.value, maxValue) : maxValue;
    const value = afterThresholdValue - (afterThresholdValue - beforeThresholdValue) / 2;

    // Set a color
    const color = colors[index];

    this.setState(
      {
        thresholds: this.sortThresholds([
          ...newThresholds,
          {
            index,
            value: value as number,
            color,
          },
        ]),
      },
      () => this.updateGauge()
    );
  };

  onRemoveThreshold = (threshold: Threshold) => {
    this.setState(
      prevState => {
        const newThresholds = prevState.thresholds.map(t => {
          if (t.index > threshold.index) {
            const index = t.index - 1;
            t = { ...t, index };
          }
          return t;
        });

        return {
          thresholds: newThresholds.filter(t => t !== threshold),
        };
      },
      () => this.updateGauge()
    );
  };

  onChangeThresholdValue = (event: any, threshold: Threshold) => {
    const { thresholds } = this.state;

    const newThresholds = thresholds.map(t => {
      if (t === threshold) {
        t = { ...t, value: event.target.value };
      }

      return t;
    });

    this.setState({ thresholds: newThresholds });
  };

  onChangeThresholdColor = (threshold: Threshold, color: string) => {
    const { thresholds } = this.state;

    const newThresholds = thresholds.map(t => {
      if (t === threshold) {
        t = { ...t, color: color };
      }

      return t;
    });

    this.setState(
      {
        thresholds: newThresholds,
      },
      () => this.updateGauge()
    );
  };

  onChangeBaseColor = (color: string) => this.props.onChange(this.state.thresholds);
  onBlur = () => {
    this.setState(prevState => ({ thresholds: this.sortThresholds(prevState.thresholds) }));

    this.updateGauge();
  };

  updateGauge = () => {
    this.props.onChange(this.state.thresholds);
  };

  sortThresholds = (thresholds: Threshold[]) => {
    return thresholds.sort((t1, t2) => {
      return t2.value - t1.value;
    });
  };

  renderInput = (threshold: Threshold) => {
    const value = threshold.index === 0 ? 'Base' : threshold.value;
    return (
      <div className="thresholds-row-input-inner">
        <span className="thresholds-row-input-inner-arrow" />
        <div className="thresholds-row-input-inner-color">
          {threshold.color && (
            <div className="thresholds-row-input-inner-color-colorpicker">
              <ColorPicker color={threshold.color} onChange={color => this.onChangeThresholdColor(threshold, color)} />
            </div>
          )}
        </div>
        <div className="thresholds-row-input-inner-value">
          <input
            type="text"
            onChange={event => this.onChangeThresholdValue(event, threshold)}
            value={value}
            onBlur={this.onBlur}
            readOnly={threshold.index === 0}
          />
        </div>
        {threshold.index > 0 && (
          <div className="thresholds-row-input-inner-remove" onClick={() => this.onRemoveThreshold(threshold)}>
            <i className="fa fa-times" />
          </div>
        )}
      </div>
    );
  };

  render() {
    const { thresholds } = this.state;

    return (
      <PanelOptionsGroup title="Thresholds">
        <div className="thresholds">
          {thresholds.map((threshold, index) => {
            return (
              <div className="thresholds-row" key={`${threshold.index}-${index}`}>
                <div className="thresholds-row-add-button" onClick={() => this.onAddThreshold(threshold.index + 1)}>
                  <i className="fa fa-plus" />
                </div>
                <div className="thresholds-row-color-indicator" style={{ backgroundColor: threshold.color }} />
                <div className="thresholds-row-input">{this.renderInput(threshold)}</div>
              </div>
            );
          })}
        </div>
      </PanelOptionsGroup>
    );
  }
}
