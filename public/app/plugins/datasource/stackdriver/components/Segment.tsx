import React, { PureComponent } from 'react';
import { getAngularLoader, AngularComponent } from 'app/core/services/AngularLoader';
import 'app/core/directives/metric_segment';

interface QueryEditorProps {
  segment: any;
  getOptions: () => Promise<any[]>;
  onChange: (segment, index) => void;
  key: number;
}

export default class Segment extends PureComponent<QueryEditorProps, any> {
  element: any;
  component: AngularComponent;

  async componentDidMount() {
    if (!this.element) {
      return;
    }

    const { segment, getOptions, onChange } = this.props;
    const loader = getAngularLoader();
    const template = '<metric-segment> </metric-segment>';

    const scopeProps = {
      segment,
      onChange,
      getOptions,
      debounce: false,
    };

    this.component = loader.load(this.element, scopeProps, template);
  }

  componentWillUnmount() {
    if (this.component) {
      this.component.destroy();
    }
  }

  render() {
    return <div ref={element => (this.element = element)} style={{ width: '100%' }} />;
  }
}
