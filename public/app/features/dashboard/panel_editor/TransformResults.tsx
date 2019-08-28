// Libraries
import React, { PureComponent } from 'react';

// Types
import { PanelModel } from '../state/index';
import { PanelData, Button, Select } from '@grafana/ui';
import { DataFrame } from '@grafana/data';
import { ByNameTransform } from './ByNameTransform';
import { TransformationConfig } from '../state/PanelModel';

interface Props {
  panel: PanelModel;
  data: PanelData;
}

interface State {
  updateCounter: number;
}

export class TransformResults extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { updateCounter: 0 };
  }

  private getPreTransformData(): DataFrame[] {
    const { panel } = this.props;
    return panel.getQueryRunner().getCurrentData(false).series;
  }

  onChange = (config: TransformationConfig) => {
    const { panel } = this.props;
    panel.transformation = config;
    panel.getQueryRunner().setTransform(config);
    this.setState({ updateCounter: this.state.updateCounter + 1 });
  };

  onAddTransform = () => {
    this.onChange({
      id: 'byName',
      args: [],
    });
  };

  render() {
    const { panel } = this.props;
    const { transformation } = panel;

    if (!transformation) {
      const options = [{ value: 'byName', label: 'Filter By Name' }];
      return (
        <div>
          <Select
            options={options}
            placeholder="Add Transformation"
            onChange={() => {
              this.onAddTransform();
            }}
          />
        </div>
      );
    }

    const input = this.getPreTransformData();
    return (
      <div>
        <ByNameTransform input={input} config={transformation} onChange={this.onChange} />
        <br />
        <Button variant={'inverse'} onClick={() => this.onChange(undefined)}>
          Remove Transformation
        </Button>
      </div>
    );
  }
}
