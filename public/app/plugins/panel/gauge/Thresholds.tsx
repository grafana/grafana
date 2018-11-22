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
    const { userAddedThresholds } = this.state;

    if (index === 0) {
      return 'green';
    } else if (index < userAddedThresholds) {
      return 'yellow';
    }

    return 'red';
  }

  renderNoThresholds() {
    const { thresholds } = this.state;

    return [
      <div className="gf-form" key="min">
        <input
          className="gf-form-input"
          onBlur={this.onBlur}
          onChange={event => this.onChangeThresholdValue(event, thresholds[0])}
          value={thresholds[0].value}
        />
        <Label width={3}>{thresholds[0].label}</Label>
      </div>,
      <div className="gf-form" key="add">
        <div
          onClick={() => this.onAddThreshold(1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            backgroundColor: 'green',
          }}
        >
          <i className="fa fa-plus" />
        </div>
        <Label width={18}>Add new threshold by clicking the line</Label>
      </div>,
      <div className="gf-form" key="max">
        <input
          className="gf-form-input"
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
        <div className="gf-form" key={`${threshold}-${index}`}>
          <input
            className="gf-form-input"
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
    } else if (index === userAddedThresholds) {
      return index - 1;
    } else if (index > 0) {
      return index + 1;
    }

    return -1;
  }

  renderIndicator() {
    const { userAddedThresholds } = this.state;

    const indicators = userAddedThresholds + 1;

    const sections = [];

    for (let i = 0; i < indicators; i++) {
      sections.push(
        <div
          key={`${i}`}
          onClick={() => this.onAddThreshold(this.insertAtIndex(i))}
          style={{
            width: '100%',
            height: `calc(100%/${indicators})`,
            cursor: 'pointer',
            background: this.getIndicatorColor(i),
          }}
        />
      );
    }

    return sections;
  }

  render() {
    const { userAddedThresholds } = this.state;

    return (
      <div className="section gf-form-group">
        <h5 className="page-heading">Thresholds</h5>
        <div style={{ display: 'flex', alignItems: 'flexStart' }}>
          <div
            style={{
              width: '20px',
              minHeight: '40px',
              flex: '0 1 auto',
            }}
          >
            {this.renderIndicator()}
          </div>
          <div style={{ flex: '1 0 auto', marginLeft: '10px' }}>
            {userAddedThresholds === 0 ? this.renderNoThresholds() : this.renderThresholds()}
          </div>
        </div>
      </div>
    );
  }
}
