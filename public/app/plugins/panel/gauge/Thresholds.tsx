import React, { PureComponent } from 'react';
import { PanelOptionsProps, Threshold } from 'app/types';
import { OptionsProps } from './module';
import { Label } from '../../../core/components/Label/Label';

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
      <div className="gf-form threshold-row threshold-row-min" key="min">
        <input
          className="gf-form-input threshold-row-input"
          onBlur={this.onBlur}
          onChange={event => this.onChangeThresholdValue(event, thresholds[0])}
          value={thresholds[0].value}
        />
        <Label width={3}>{thresholds[0].label}</Label>
      </div>,
      <div className="gf-form threshold-row" key="add">
        <div onClick={() => this.onAddThreshold(1)} className="threshold-row-add">
          <i className="fa fa-plus" />
        </div>
        <Label className="threshold-row-label" width={18}>
          Add new threshold by clicking the line
        </Label>
      </div>,
      <div className="gf-form threshold-row threshold-row-max" key="max">
        <input
          className="gf-form-input threshold-row-input"
          onBlur={this.onBlur}
          onChange={event => this.onChangeThresholdValue(event, thresholds[1])}
          value={thresholds[1].value}
        />
        <Label width={3}>{thresholds[0].label}</Label>
      </div>,
    ];
  }

  renderThresholds() {
    const { thresholds } = this.state;
    return thresholds.map((threshold, index) => {
      return (
        <div
          className={`gf-form threshold-row ${index === 0 ? 'threshold-row-min' : ''} ${
            index === thresholds.length ? 'threshold-row-max' : ''
          } `}
          key={`${threshold}-${index}`}
        >
          <input
            className="gf-form-input threshold-row-input"
            type="text"
            onChange={event => this.onChangeThresholdValue(event, threshold)}
            value={threshold.value}
            onBlur={this.onBlur}
          />
          {threshold.canRemove ? (
            <div
              onClick={() => this.onRemoveThreshold(threshold)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
              }}
            >
              <i className="fa fa-times" />
            </div>
          ) : (
            <Label width={3}>{threshold.label}</Label>
          )}
        </div>
      );
    });
  }

  insertAtIndex(index) {
    const { userAddedThresholds } = this.state;

    if (userAddedThresholds === 0) {
      return 1;
    } else if (userAddedThresholds > 1 && index === this.state.thresholds.length) {
      return index - 1;
    } else if (index === 0) {
      return 1;
    } else if (index > 0) {
      return index;
    }

    // SAD
    return -1;
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
          onClick={() => this.onAddThreshold(this.insertAtIndex(index - 1))}
          style={{
            height: '50%',
            background: this.getIndicatorColor(index),
          }}
        >
          d
        </div>
        <div
          onClick={() => this.onAddThreshold(this.insertAtIndex(index))}
          style={{
            height: `50%`,
            cursor: 'pointer',
            background: this.getIndicatorColor(index),
          }}
        >
          i
        </div>
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
