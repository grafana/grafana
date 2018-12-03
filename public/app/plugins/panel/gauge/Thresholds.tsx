import React, { PureComponent } from 'react';
import classNames from 'classnames/bind';
import { ColorPicker } from 'app/core/components/colorpicker/ColorPicker';
import { OptionModuleProps } from './module';
import { Threshold } from 'app/types';

interface State {
  thresholds: Threshold[];
}

enum BasicGaugeColor {
  Green = 'rgba(50, 172, 45, 0.97)',
  Orange = 'rgba(237, 129, 40, 0.89)',
  Red = 'rgb(212, 74, 58)',
}

export default class Thresholds extends PureComponent<OptionModuleProps, State> {
  constructor(props) {
    super(props);

    this.state = {
      thresholds: this.props.options.thresholds || [
        { index: 0, label: 'Min', value: 0, canRemove: false, color: BasicGaugeColor.Green },
        { index: 1, label: 'Max', value: 100, canRemove: false },
      ],
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

    // Setting value to a value between the new threshold.
    const value = newThresholds[index].value - (newThresholds[index].value - newThresholds[index - 1].value) / 2;

    this.setState(
      {
        thresholds: this.sortThresholds([
          ...newThresholds,
          { index: index, label: '', value: value, canRemove: true, color: BasicGaugeColor.Orange },
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

  getIndicatorColor(index) {
    const { thresholds } = this.state;

    if (index === 0) {
      return thresholds[0].color;
    }

    return index < thresholds.length ? thresholds[index].color : BasicGaugeColor.Red;
  }

  renderNoThresholds() {
    const { thresholds } = this.state;

    const min = thresholds[0];
    const max = thresholds[1];

    return [
      <div className="threshold-row threshold-row-min" key="min">
        <div className="threshold-row-inner">
          <div className="threshold-row-color">
            <div className="threshold-row-color-inner">
              <ColorPicker color={min.color} onChange={color => this.onChangeThresholdColor(min, color)} />
            </div>
          </div>
          <input
            className="threshold-row-input"
            onBlur={this.onBlur}
            onChange={event => this.onChangeThresholdValue(event, min)}
            value={min.value}
          />
          <div className="threshold-row-label">{min.label}</div>
        </div>
      </div>,
      <div className="threshold-row" key="add">
        <div className="threshold-row-inner">
          <div onClick={() => this.onAddThreshold(1)} className="threshold-row-add">
            <i className="fa fa-plus" />
          </div>
          <div className="threshold-row-add-label">Add new threshold by clicking the line.</div>
        </div>
      </div>,
      <div className="threshold-row threshold-row-max" key="max">
        <div className="threshold-row-inner">
          <div className="threshold-row-color" />
          <input
            className="threshold-row-input"
            onBlur={this.onBlur}
            onChange={event => this.onChangeThresholdValue(event, max)}
            value={max.value}
          />
          <div className="threshold-row-label">{max.label}</div>
        </div>
      </div>,
    ];
  }

  renderThresholds() {
    const { thresholds } = this.state;

    return thresholds.map((threshold, index) => {
      const rowStyle = classNames({
        'threshold-row': true,
        'threshold-row-min': index === 0,
        'threshold-row-max': index === thresholds.length - 1,
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
            {threshold.canRemove ? (
              <div onClick={() => this.onRemoveThreshold(threshold)} className="threshold-row-remove">
                <i className="fa fa-times" />
              </div>
            ) : (
              <div className="threshold-row-label">{threshold.label}</div>
            )}
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

    const indicators = thresholds.length - 1;

    const sections = [];

    for (let i = 0; i < indicators; i++) {
      sections.push(this.renderIndicatorSection(i));
    }

    return sections;
  }

  render() {
    const { thresholds } = this.state;

    return (
      <div className="section gf-form-group">
        <h5 className="page-heading">Thresholds</h5>
        <div className="thresholds">
          <div className="color-indicators">{this.renderIndicator()}</div>
          <div className="threshold-rows">
            {thresholds.length > 2 ? this.renderThresholds() : this.renderNoThresholds()}
          </div>
        </div>
      </div>
    );
  }
}
