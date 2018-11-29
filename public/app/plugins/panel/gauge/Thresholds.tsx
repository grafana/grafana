import React, { PureComponent } from 'react';
import classNames from 'classnames/bind';
import { PanelOptionsProps, Threshold } from 'app/types';
import { OptionsProps } from './module';
import { ColorPicker } from '../../../core/components/colorpicker/ColorPicker';

interface State {
  thresholds: Threshold[];
  userAddedThresholds: number;
}

export default class Thresholds extends PureComponent<PanelOptionsProps<OptionsProps>, State> {
  constructor(props) {
    super(props);

    this.state = {
      thresholds: this.props.options.thresholds || [
        { index: 0, label: 'Min', value: 0, canRemove: false, color: 'rgba(50, 172, 45, 0.97)' },
        { index: 1, label: 'Max', value: 100, canRemove: false },
      ],
      userAddedThresholds: 0,
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
      prevState => ({
        thresholds: this.sortThresholds([
          ...newThresholds,
          { index: index, label: '', value: value, canRemove: true, color: 'rgba(237, 129, 40, 0.89)' },
        ]),
        userAddedThresholds: prevState.userAddedThresholds + 1,
      }),
      () => this.updateGauge()
    );
  };

  onRemoveThreshold = threshold => {
    this.setState(prevState => ({
      thresholds: prevState.thresholds.filter(t => t !== threshold),
      userAddedThresholds: prevState.userAddedThresholds - 1,
    }));
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

    return index < thresholds.length ? thresholds[index].color : 'rgb(212, 74, 58)';
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
    const { userAddedThresholds } = this.state;

    if (userAddedThresholds === 0 || index < 0) {
      return 1;
    }

    return index;
  }

  renderIndicatorSection(index) {
    const { userAddedThresholds } = this.state;
    const indicators = userAddedThresholds + 1;

    if (index === 0 || index === this.state.thresholds.length) {
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
    const { userAddedThresholds } = this.state;

    const indicators = userAddedThresholds + 1;

    const sections = [];

    for (let i = 0; i < indicators; i++) {
      sections.push(this.renderIndicatorSection(i));
    }

    return sections;
  }

  render() {
    const { userAddedThresholds } = this.state;

    return (
      <div className="section gf-form-group">
        <h5 className="page-heading">Thresholds</h5>
        <div className="thresholds">
          <div className="color-indicators">{this.renderIndicator()}</div>
          <div className="threshold-rows">
            {userAddedThresholds === 0 ? this.renderNoThresholds() : this.renderThresholds()}
          </div>
        </div>
      </div>
    );
  }
}
