import React, { PureComponent, createRef } from 'react';
import JSONFormatterJS, { JSONFormatterConfiguration } from 'json-formatter-js';

interface Props {
  className?: string;
  json: {};
  config?: JSONFormatterConfiguration;
  open?: number;
}

export class JSONFormatter extends PureComponent<Props> {
  private wrapperRef = createRef<HTMLDivElement>();
  private formatter: any;

  static defaultProps = {
    open: 3,
    config: {
      animateOpen: true,
      theme: 'dark',
    },
  };

  componentDidMount() {
    this.renderJson();
  }

  componentDidUpdate() {
    this.renderJson();
  }

  renderJson = () => {
    const { json, config, open } = this.props;
    this.formatter = new JSONFormatterJS(json, open, config);
    const wrapperEl = this.wrapperRef.current;
    const newJsonHtml = this.formatter.render();
    const hasChildren: boolean = wrapperEl.hasChildNodes();
    if (hasChildren) {
      wrapperEl.replaceChild(newJsonHtml, wrapperEl.lastChild);
    } else {
      wrapperEl.appendChild(newJsonHtml);
    }
  };

  componentWillUnmount() {
    this.formatter = null;
  }

  render() {
    const { className } = this.props;
    return <div className={className} ref={this.wrapperRef} />;
  }
}
