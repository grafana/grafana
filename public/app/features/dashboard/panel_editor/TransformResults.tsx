// Libraries
import React, { PureComponent } from 'react';

// Types
import { PanelModel } from '../state/index';
import { PanelData } from '@grafana/ui';
import { DataFrame } from '@grafana/data';

interface Props {
  panel: PanelModel;
  data: PanelData;
}

interface State {
  preTransform?: DataFrame[];
}

export class TransformResults extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      preTransform: this.getPreTransformData(),
    };
  }

  componentDidUpdate(prevProps: Props) {
    const { data } = this.props;
    if (data !== prevProps.data) {
      this.setState({
        preTransform: this.getPreTransformData(),
      });
    }
  }

  private getPreTransformData(): DataFrame[] | undefined {
    const { panel, data } = this.props;
    const withoutTransform = panel.getQueryRunner().getCurrentData(false);
    if (withoutTransform === data) {
      return undefined;
    }
    return withoutTransform.series;
  }

  render() {
    return <div>HELLO!!!</div>;
  }
}
