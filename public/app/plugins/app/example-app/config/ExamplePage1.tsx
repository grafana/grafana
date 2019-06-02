// Libraries
import React, { PureComponent } from 'react';

// Types
import { PluginConfigPageProps, AppPlugin } from '@grafana/ui';

interface Props extends PluginConfigPageProps<AppPlugin> {}

import { Drawer, Button, Badge, Avatar, Slider, Radio, Layout, Modal, Timeline, TreeSelect } from 'antd';
import { SliderValue } from 'antd/lib/slider';

const { Header, Footer, Sider, Content } = Layout;

const SHOW_PARENT = TreeSelect.SHOW_PARENT;

const treeData = [
  {
    title: 'Node1',
    value: '0-0',
    key: '0-0',
    children: [
      {
        title: 'Child Node1',
        value: '0-0-0',
        key: '0-0-0',
      },
    ],
  },
  {
    title: 'Node2',
    value: '0-1',
    key: '0-1',
    children: [
      {
        title: 'Child Node3',
        value: '0-1-0',
        key: '0-1-0',
      },
      {
        title: 'Child Node4',
        value: '0-1-1',
        key: '0-1-1',
      },
      {
        title: 'Child Node5',
        value: '0-1-2',
        key: '0-1-2',
      },
    ],
  },
];

interface State {
  visible: boolean;
  radio: string; //'modal' | 'drawer';
  treeValue: string[];
}

export class ExamplePage1 extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      visible: false,
      radio: 'drawer',
      treeValue: ['0-0-0'],
    };
  }

  onTreeValueChange = (treeValue: string[]) => {
    console.log('onChange ', treeValue);
    this.setState({ treeValue });
  };

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

  onSliderChange = (value: SliderValue) => {
    console.log('onChange: ', value);
  };

  onRadioChange = (e: any) => {
    console.log('radio checked', e);
    this.setState({
      radio: `${e.target.value}`,
    });
  };

  handleOk = (e: React.MouseEvent<any>) => {
    console.log(e);
    this.setState({
      visible: false,
    });
  };

  handleCancel = (e: React.MouseEvent<any>) => {
    console.log(e);
    this.setState({
      visible: false,
    });
  };

  renderTeeSelect() {
    const tProps = {
      treeData,
      value: this.state.treeValue,
      onChange: this.onTreeValueChange,
      treeCheckable: true,
      showCheckedStrategy: SHOW_PARENT,
      searchPlaceholder: 'Please select',
      style: {
        width: 300,
      },
    };
    return <TreeSelect {...tProps} />;
  }

  renderTimeline() {
    return (
      <Timeline>
        <Timeline.Item color="green">Create a services site 2015-09-01</Timeline.Item>
        <Timeline.Item color="green">Create a services site 2015-09-01</Timeline.Item>
        <Timeline.Item color="red">
          <p>Solve initial network problems 1</p>
          <p>Solve initial network problems 2</p>
          <p>Solve initial network problems 3 2015-09-01</p>
        </Timeline.Item>
        <Timeline.Item>
          <p>Technical testing 1</p>
          <p>Technical testing 2</p>
          <p>Technical testing 3 2015-09-01</p>
        </Timeline.Item>
      </Timeline>
    );
  }

  renderLayout() {
    return (
      <Layout>
        <Header>Header</Header>
        <Layout>
          <Content>Content</Content>
        </Layout>
        <Footer>Footer</Footer>
      </Layout>
    );
  }

  render() {
    const { query } = this.props;
    const radioStyle = {
      display: 'block',
      height: '30px',
      lineHeight: '30px',
    };
    return (
      <div>
        <pre>{JSON.stringify(query)}</pre>

        <div>
          <Radio.Group onChange={this.onRadioChange} value={this.state.radio}>
            <Radio style={radioStyle} value={'modal'}>
              Modal
            </Radio>
            <Radio style={radioStyle} value={'drawer'}>
              Drawer
            </Radio>
          </Radio.Group>
        </div>

        <div>
          <Button type="primary" onClick={this.showDrawer}>
            Open
          </Button>
          <Drawer
            title="Basic Drawer"
            placement="right"
            closable={true}
            onClose={this.onClose}
            visible={this.state.visible && this.state.radio === 'drawer'}
          >
            <p>Some contents...</p>
            <p>Some contents...</p>
            <p>Some contents...</p>
          </Drawer>

          <Modal
            title="Basic Modal"
            visible={this.state.visible && this.state.radio === 'modal'}
            onOk={this.handleOk}
            onCancel={this.handleCancel}
          >
            <p>Some contents...</p>
            <p>Some contents...</p>
            <p>Some contents...</p>
          </Modal>
        </div>
        <div>
          <br />
          <br />
          {this.renderTeeSelect()}
          <br />
          <br />
          <Badge count={99}>
            <Avatar size="large" icon="user" />
          </Badge>

          <br />
          <br />
          <Slider range={true} step={10} defaultValue={[20, 50]} onChange={this.onSliderChange} />
          <br />
          <br />
          {this.renderTimeline()}
          <br />
          <br />
          {this.renderTimeline()}
          <br />
          <br />
          {this.renderLayout()}
        </div>
      </div>
    );
  }
}
