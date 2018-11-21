import React, { PureComponent } from 'react';
import JSONFormatterJS from 'json-formatter-js';

interface Props {
  className?: string;
  json: any;
  config?: any;
  open?: number;
}

export class JSONFormatter extends PureComponent<Props> {
  wrapperEl: any = React.createRef();
  jsonEl: HTMLElement;
  formatter: any;

  static defaultProps = {
    open: 3,
    config: {
      animateOpen: true,
    },
  };

  componentDidMount() {
    const { json, config, open } = this.props;
    this.formatter = new JSONFormatterJS(json, open, config);
    this.jsonEl = this.wrapperEl.current.appendChild(this.formatter.render());
  }

  componentWillUnmount() {
    this.formatter = null;
    this.jsonEl = null;
  }

  render() {
    const { className } = this.props;
    return <div className={className} ref={this.wrapperEl} />;
  }
}
