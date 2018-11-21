import React, { PureComponent } from 'react';
import { PanelOptionsProps, Threshold } from 'app/types';
import { OptionsProps } from './module';
import { Label } from '../../../core/components/Label/Label';

interface State {
  thresholds: Threshold[];
}

export default class Thresholds extends PureComponent<PanelOptionsProps<OptionsProps>, State> {
  constructor(props) {
    super(props);

    this.state = {
      thresholds: this.props.options.thresholds || [
        { label: 'Min', value: 0, canRemove: false },
        { label: 'Max', value: 100, canRemove: false },
      ],
    };
  }

  onAddThreshold = () => {
    this.setState(prevState => ({
      thresholds: [...prevState.thresholds, { label: 'T1', value: 0, canRemove: true }],
    }));
  };

  onRemoveThreshold = threshold => {
    this.setState(prevState => ({
      thresholds: prevState.thresholds.filter(t => t !== threshold),
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

  onChangeThresholdLabel = (event, threshold) => {
    const newThresholds = this.state.thresholds.map(currentThreshold => {
      if (currentThreshold === threshold) {
        currentThreshold = { ...currentThreshold, label: event.target.value };
      }

      return currentThreshold;
    });

    this.setState({
      thresholds: newThresholds,
    });
  };

  onBlur = () => {
    this.sortThresholds();

    this.props.onChange({ ...this.props.options, thresholds: this.state.thresholds });
  };

  sortThresholds = () => {
    console.log('sort');
    this.setState(prevState => ({
      thresholds: prevState.thresholds.sort((t1, t2) => t1.value - t2.value),
    }));
  };

  render() {
    const { thresholds } = this.state;

    return (
      <div className="section gf-form-group">
        <h5 className="page-heading">Thresholds</h5>
        <div style={{ display: 'flex', alignItems: 'flexStart' }}>
          <div
            style={{
              width: '20px',
              minHeight: '40px',
              flex: '0 1 auto',
              background: 'linear-gradient(to bottom, green, red)',
            }}
          />
          <div style={{ flex: '1 0 auto' }}>
            {thresholds.map((threshold, index) => {
              return (
                <div className="gf-form" key={`${threshold}-${index}`}>
                  {!threshold.canRemove ? (
                    <Label width={5}>{threshold.label}</Label>
                  ) : (
                    <input
                      className="gf-form-input width-7"
                      onBlur={this.onBlur}
                      onChange={event => this.onChangeThresholdLabel(event, threshold)}
                      value={threshold.label}
                    />
                  )}
                  <input
                    className="gf-form-input"
                    type="text"
                    value={threshold.value}
                    onChange={event => this.onChangeThresholdValue(event, threshold)}
                    onBlur={this.onBlur}
                  />
                  {threshold.canRemove && (
                    <span onClick={() => this.onRemoveThreshold(threshold)}>
                      <i className="fa fa-remove" />
                    </span>
                  )}
                </div>
              );
            })}
            <div className="gf-form">
              <Label width={5}>Add</Label>
              <span className="gf-form-input" onClick={this.onAddThreshold}>
                +
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
