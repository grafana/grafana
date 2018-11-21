import React, { PureComponent } from 'react';
import JSONFormatterJS from 'json-formatter-js';

interface Props {
  className?: string;
  json: any;
  options?: any;
}

export class JSONFormatter extends PureComponent<Props> {
  wrapperEl: any = React.createRef();
  jsonEl: HTMLElement;
  formatter: any;

  componentDidMount() {
    const { json, options } = this.props;
    this.formatter = new JSONFormatterJS(json, options);
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
