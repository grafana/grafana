import React, { PureComponent } from 'react';
import { PanelOptionsProps, Threshold } from 'app/types';
import { OptionsProps } from './module';
import { Label } from '../../../core/components/Label/Label';

interface State {
  thresholds: Threshold[];
}

export default class Thresholds extends PureComponent<PanelOptionsProps<OptionsProps>, State> {
  state = {
    thresholds: [{ label: 'Min', value: 0 }, { label: 'Max', value: 100 }],
  };

  onAddThreshold = () => {
    this.setState(prevState => ({
      thresholds: [prevState.thresholds[0], { label: '', value: 0 }, { label: 'Max', value: 100 }],
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
                  <Label width={5}>{threshold.label}</Label>
                  <input className="gf-form-input" type="text" value={threshold.value} />
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
