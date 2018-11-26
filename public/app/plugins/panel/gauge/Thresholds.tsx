import React, { PureComponent } from 'react';
import classNames from 'classnames/bind';
import { PanelOptionsProps, Threshold } from 'app/types';
import { OptionsProps } from './module';

interface State {
  thresholds: Threshold[];
  userAddedThresholds: number;
}

export default class Thresholds extends PureComponent<PanelOptionsProps<OptionsProps>, State> {
  constructor(props) {
    super(props);

    this.state = {
      thresholds: this.props.options.thresholds || [
        { index: 0, label: 'Min', value: 0, canRemove: false },
        { index: 1, label: 'Max', value: 100, canRemove: false },
      ],
      userAddedThresholds: 0,
    };
  }

  onAddThreshold = index => {
    console.log('add at index', index);
    const newThresholds = this.state.thresholds.map(threshold => {
      if (threshold.index >= index) {
        threshold = { ...threshold, index: threshold.index + 1 };
      }

      return threshold;
    });

    const userAddedThresholds = this.state.userAddedThresholds + 1;

    this.setState({
      thresholds: this.sortThresholds([...newThresholds, { index: index, label: '', value: 0, canRemove: true }]),
      userAddedThresholds: userAddedThresholds,
    });
  };

  onRemoveThreshold = threshold => {
    this.setState(prevState => ({
      thresholds: prevState.thresholds.filter(t => t !== threshold),
      userAddedThresholds: prevState.userAddedThresholds - 1,
    }));
  };

  onChangeThresholdValue = (event, threshold) => {
    const newThresholds = this.state.thresholds.map(currentThreshold => {
      if (currentThreshold === threshold) {
        currentThreshold = { ...currentThreshold, value: event.target.value };
      }

      return currentThreshold;
    });

    this.setState({
      thresholds: newThresholds,
    });
  };

  onBlur = () => {
    this.setState(prevState => ({
      thresholds: this.sortThresholds(prevState.thresholds),
    }));

    this.props.onChange({ ...this.props.options, thresholds: this.state.thresholds });
  };

  sortThresholds = thresholds => {
    return thresholds.sort((t1, t2) => {
      return t1.index - t2.index;
    });
  };

  getIndicatorColor(index) {
    const { thresholds } = this.state;

    if (index === 0) {
      return 'green';
    } else if (index < thresholds.length) {
      return 'yellow';
    }

    return 'red';
  }

  renderNoThresholds() {
    const { thresholds } = this.state;

    return [
      <div className="threshold-row threshold-row-min" key="min">
        <div className="threshold-row-inner">
          <div className="threshold-row-color" />
          <input
            className="threshold-row-input"
            onBlur={this.onBlur}
            onChange={event => this.onChangeThresholdValue(event, thresholds[0])}
            value={thresholds[0].value}
          />
          <div className="threshold-row-label">{thresholds[0].label}</div>
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
            onChange={event => this.onChangeThresholdValue(event, thresholds[1])}
            value={thresholds[1].value}
          />
          <div className="threshold-row-label">{thresholds[1].label}</div>
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
        'threshold-row-max': index === thresholds.length,
      });

      return (
        <div className={rowStyle} key={`${threshold.index}-${index}`}>
          <div className="threshold-row-inner">
            <div className="threshold-row-color" />
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
            cursor: 'pointer',
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
