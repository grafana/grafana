// Libraries
import React, { PureComponent } from 'react';

// Types
import { PluginConfigPageProps, AppPlugin } from '@grafana/ui';

interface Props extends PluginConfigPageProps<AppPlugin> {}

import { Drawer, Button, Badge } from 'antd';

interface State {
  visible: boolean;
}

export class ExamplePage1 extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      visible: false,
    };
  }

  showDrawer = () => {
    this.setState({
      visible: true,
    });
  };

  onClose = () => {
    this.setState({
      visible: false,
    });
  };

  render() {
    const { query } = this.props;

    return (
      <div>
        <pre>{JSON.stringify(query)}</pre>

        <div>
          <Button type="primary" onClick={this.showDrawer}>
            Drawer
          </Button>
          <Drawer
            title="Basic Drawer"
            placement="right"
            closable={true}
            onClose={this.onClose}
            visible={this.state.visible}
          >
            <p>Some contents...</p>
            <p>Some contents...</p>
            <p>Some contents...</p>
          </Drawer>
        </div>
        <div>
          <Badge count={99}>
            <a href="#" className="head-example" />
          </Badge>
        </div>
      </div>
    );
  }
}
