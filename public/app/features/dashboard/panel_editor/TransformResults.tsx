// Libraries
import React, { PureComponent } from 'react';

// Types
import { PanelModel } from '../state/index';
import { PanelData } from '@grafana/ui';

interface Props {
  panel: PanelModel;
  data: PanelData;
}

interface State {
  noTransform?: PanelData;
}

export class TransformResults extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    const noTransform = props.panel.getQueryRunner().getLastResult(false);
    this.state = {
      noTransform: noTransform === props.data ? undefined : noTransform,
    };
  }

  componentDidUpdate(prevProps: Props) {
    const { data } = this.props;
    if (data !== prevProps.data) {
      const noTransform = this.props.panel.getQueryRunner().getLastResult(false);
      this.setState({
        noTransform: noTransform === data ? undefined : noTransform,
      });
    }
  }

  render() {
    return <div>HELLO!!!</div>;
  }
}
