import React, { PureComponent } from 'react';
import classNames from 'classnames/bind';
import tinycolor from 'tinycolor2';
import { ColorPicker } from 'app/core/components/colorpicker/ColorPicker';
import { OptionModuleProps } from './module';
import { BasicGaugeColor, Threshold } from 'app/types';

interface State {
  thresholds: Threshold[];
}

export default class Thresholds extends PureComponent<OptionModuleProps, State> {
  constructor(props) {
    super(props);

    this.state = {
      thresholds: props.options.thresholds,
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

  renderThresholds() {
    const { thresholds } = this.state;

    return thresholds.map((threshold, index) => {
      const rowStyle = classNames({
        'threshold-row': true,
        'threshold-row-min': index === 0,
      });

      return (
        <div className={rowStyle} key={`${threshold.index}-${index}`}>
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

  insertAtIndex(index) {
    const { thresholds } = this.state;

    // If thresholds.length is greater or equal to 3
    // it means a user has added one threshold
    if (thresholds.length < 3 || index < 0) {
      return 1;
    }

    return index;
  }

  renderIndicatorSection(index) {
    const { thresholds } = this.state;
    const indicators = thresholds.length - 1;

    if (index === 0 || index === thresholds.length) {
      return (
        <div
          key={index}
          className="indicator-section"
          style={{
            height: `calc(100%/${indicators})`,
          }}
        >
          <div
            onClick={() => this.onAddThreshold(this.insertAtIndex(index - 1))}
            style={{
              height: '100%',
              background: this.getIndicatorColor(index),
            }}
          />
        </div>
      );
    }

    return (
      <div
        key={index}
        className="indicator-section"
        style={{
          height: `calc(100%/${indicators})`,
        }}
      >
        <div
          onClick={() => this.onAddThreshold(this.insertAtIndex(index))}
          style={{
            height: '50%',
            background: this.getIndicatorColor(index),
          }}
        />
        <div
          onClick={() => this.onAddThreshold(this.insertAtIndex(index + 1))}
          style={{
            height: `50%`,
            background: this.getIndicatorColor(index),
          }}
        />
      </div>
    );
  }

  renderIndicator() {
    const { thresholds } = this.state;

    if (thresholds.length > 0) {
      return thresholds.map((t, i) => {
        if (i <= thresholds.length - 1) {
          return this.renderIndicatorSection(i);
        }

        return null;
      });
    }

    return (
      <div className="indicator-section" style={{ height: '100%' }}>
        <div
          onClick={() => this.onAddThreshold(0)}
          style={{ height: '100%', backgroundColor: this.props.options.baseColor }}
        />
      </div>
    );
  }

  render() {
    const { thresholds } = this.state;

    return (
      <div className="section gf-form-group">
        <h5 className="page-heading">Thresholds</h5>
        <span>Click the colored line to add a threshold</span>
        <div className="thresholds">
          <div className="color-indicators">{this.renderIndicator()}</div>
          <div className="threshold-rows">
            <div className="threshold-row threshold-row-base">
              <div className="threshold-row-inner">
                <div className="threshold-row-color">
                  <div className="threshold-row-color-inner">
                    <ColorPicker color={BasicGaugeColor.Green} onChange={color => this.onChangeBaseColor(color)} />
                  </div>
                </div>
                <div className="threshold-row-label">Base</div>
              </div>
            </div>
            {thresholds.length > 0 && this.renderThresholds()}
          </div>
        </div>
      </div>
    );
  }
}
