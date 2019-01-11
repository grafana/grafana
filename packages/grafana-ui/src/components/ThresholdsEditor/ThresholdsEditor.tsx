import React, { PureComponent } from 'react';
import tinycolor, { ColorInput } from 'tinycolor2';

import { Threshold, BasicGaugeColor } from '../../types';
import { ColorPicker } from '../ColorPicker/ColorPicker';

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

    this.state = { thresholds: props.thresholds, baseColor: BasicGaugeColor.Green };
  }

  onAddThreshold = (index: number) => {
    const maxValue = 100; // hardcoded for now before we add the base threshold
    const minValue = 0; // hardcoded for now before we add the base threshold
    const { thresholds } = this.state;

    const newThresholds = thresholds.map(threshold => {
      if (threshold.index >= index) {
        threshold = {
          ...threshold,
          index: threshold.index + 1,
        };
      }

      return threshold;
    });

    // Setting value to a value between the previous thresholds
    let value;

    if (index === 0 && thresholds.length === 0) {
      value = maxValue - (maxValue - minValue) / 2;
    } else if (index === 0 && thresholds.length > 0) {
      value = newThresholds[index + 1].value - (newThresholds[index + 1].value - minValue) / 2;
    } else if (index > newThresholds[newThresholds.length - 1].index) {
      value = maxValue - (maxValue - newThresholds[index - 1].value) / 2;
    }

    // Set a color that lies between the previous thresholds
    let color;
    if (index === 0 && thresholds.length === 0) {
      color = tinycolor.mix(BasicGaugeColor.Green, BasicGaugeColor.Red, 50).toRgbString();
    } else {
      color = tinycolor.mix(thresholds[index - 1].color as ColorInput, BasicGaugeColor.Red, 50).toRgbString();
    }

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
      prevState => ({ thresholds: prevState.thresholds.filter(t => t !== threshold) }),
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

  renderThresholds() {
    const { thresholds } = this.state;

    return thresholds.map((threshold, index) => {
      return (
        <div className="threshold-row" key={`${threshold.index}-${index}`}>
          <div className="threshold-row-inner">
            <div className="threshold-row-color">
              {threshold.color && (
                <div className="threshold-row-color-inner">
                  <ColorPicker
                    color={threshold.color}
                    onChange={color => this.onChangeThresholdColor(threshold, color)}
                  />
                </div>
              )}
            </div>
            <input
              className="threshold-row-input"
              type="text"
              onChange={event => this.onChangeThresholdValue(event, threshold)}
              value={threshold.value}
              onBlur={this.onBlur}
            />
            <div onClick={() => this.onRemoveThreshold(threshold)} className="threshold-row-remove">
              <i className="fa fa-times" />
            </div>
          </div>
        </div>
      );
    });
  }

  renderIndicator() {
    const { thresholds } = this.state;

    return thresholds.map((t, i) => {
      return (
        <div key={`${t.value}-${i}`} className="indicator-section">
          <div onClick={() => this.onAddThreshold(t.index + 1)} style={{ height: '50%', backgroundColor: t.color }} />
          <div onClick={() => this.onAddThreshold(t.index)} style={{ height: '50%', backgroundColor: t.color }} />
        </div>
      );
    });
  }

  renderBaseIndicator() {
    return (
      <div className="indicator-section" style={{ height: '100%' }}>
        <div
          onClick={() => this.onAddThreshold(0)}
          style={{ height: '100%', backgroundColor: BasicGaugeColor.Green }}
        />
      </div>
    );
  }

  renderBase() {
    const baseColor = BasicGaugeColor.Green;

    return (
      <div className="threshold-row threshold-row-base">
        <div className="threshold-row-inner threshold-row-inner--base">
          <div className="threshold-row-color">
            <div className="threshold-row-color-inner">
              <ColorPicker color={baseColor} onChange={color => this.onChangeBaseColor(color)} />
            </div>
          </div>
          <div className="threshold-row-label">Base</div>
        </div>
      </div>
    );
  }

  render() {
    return (
      <div className="section gf-form-group">
        <h5 className="section-heading">Thresholds</h5>
        <div className="thresholds">
          <div className="color-indicators">
            {this.renderIndicator()}
            {this.renderBaseIndicator()}
          </div>
          <div className="threshold-rows">
            {this.renderThresholds()}
            {this.renderBase()}
          </div>
        </div>
      </div>
    );
  }
}
