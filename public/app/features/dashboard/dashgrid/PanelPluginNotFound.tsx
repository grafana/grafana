import _ from 'lodash';
import React, { PureComponent } from 'react';

interface Props {
  pluginId: string;
}

export class PanelPluginNotFound extends PureComponent<Props> {
  constructor(props) {
    super(props);
  }

  render() {
    return <h2>Panel plugin with id {this.props.id} could not be found</h2>;
  }
}
