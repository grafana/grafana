import React, { PureComponent } from 'react';
import tinycolor from 'tinycolor2';
import { ColorPicker } from 'app/core/components/colorpicker/ColorPicker';
import { OptionModuleProps } from './module';
import { BasicGaugeColor, Threshold } from 'app/types';

interface State {
  thresholds: Threshold[];
  baseColor: string;
}

export default class Thresholds extends PureComponent<OptionModuleProps, State> {
  constructor(props) {
    super(props);

    this.state = {
      thresholds: [{ value: 50, canRemove: true, color: '#f2f2f2', index: 0, label: '' }],
      baseColor: props.options.baseColor,
    };
  }

  onAddThreshold = index => {
    const { thresholds } = this.state;

    const newThresholds = thresholds.map(threshold => {
      if (threshold.index >= index) {
        threshold = { ...threshold, index: threshold.index + 1 };
      }

      return threshold;
    });

    // Setting value to a value between the previous thresholds
    const value = newThresholds[index].value - (newThresholds[index].value - newThresholds[index - 1].value) / 2;

    // Set a color that lies between the previous thresholds
    const color = tinycolor.mix(thresholds[index - 1].color, thresholds[index].color, 50).toRgbString();

    this.setState(
      {
        thresholds: this.sortThresholds([
          ...newThresholds,
          { index: index, label: '', value: value, canRemove: true, color: color },
        ]),
      },
      () => this.updateGauge()
    );
  };

  onRemoveThreshold = threshold => {
    this.setState(
      prevState => ({
        thresholds: prevState.thresholds.filter(t => t !== threshold),
      }),
      () => this.updateGauge()
    );
  };

  onChangeThresholdValue = (event, threshold) => {
    const { thresholds } = this.state;

    const newThresholds = thresholds.map(t => {
      if (t === threshold) {
        t = { ...t, value: event.target.value };
      }

      return t;
    });

    this.setState({
      thresholds: newThresholds,
    });
  };

  onChangeThresholdColor = (threshold, color) => {
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

  onChangeBaseColor = color => this.props.onChange({ ...this.props.options, baseColor: color });
  onBlur = () => {
    this.setState(prevState => ({
      thresholds: this.sortThresholds(prevState.thresholds),
    }));

    this.updateGauge();
  };

  updateGauge = () => {
    this.props.onChange({ ...this.props.options, thresholds: this.state.thresholds });
  };

  sortThresholds = thresholds => {
    return thresholds.sort((t1, t2) => {
      return t1.value - t2.value;
    });
  };

  getIndicatorColor = index => {
    const { thresholds } = this.state;

    if (index === 0) {
      return thresholds[0].color;
    }

    return index < thresholds.length ? thresholds[index].color : BasicGaugeColor.Red;
  };

  insertAtIndex(index) {
    const { thresholds } = this.state;

    // If thresholds.length is greater or equal to 3
    // it means a user has added one threshold
    if (thresholds.length < 3 || index < 0) {
      return 1;
    }

    return index;
  }

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
        <div
          key={`${t.value}-${i}`}
          className="indicator-section"
          style={{
            height: '50%',
          }}
        >
          <div
            onClick={() => this.onAddThreshold(this.insertAtIndex(1))}
            style={{
              height: '100%',
              background: this.getIndicatorColor(i),
            }}
          />
        </div>
      );
    });
  }

  renderBaseIndicator() {
    return (
      <div className="indicator-section" style={{ height: '100%' }}>
        <div
          onClick={() => this.onAddThreshold(1)}
          style={{ height: '50px', backgroundColor: this.props.options.baseColor }}
        />
      </div>
    );
  }

  renderBase() {
    const { baseColor } = this.props.options;

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
        <h5 className="page-heading">Thresholds</h5>
        <span>Click the colored line to add a threshold</span>
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
