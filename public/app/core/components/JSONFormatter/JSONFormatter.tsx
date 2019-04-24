import React, { PureComponent, createRef } from 'react';
import { JsonExplorer } from 'app/core/core'; // We have made some monkey-patching of json-formatter-js so we can't switch right now

interface Props {
  className?: string;
  json: {};
  config?: any;
  open?: number;
  onDidRender?: (formattedJson: any) => void;
}

export class JSONFormatter extends PureComponent<Props> {
  private wrapperRef = createRef<HTMLDivElement>();

  static defaultProps = {
    open: 3,
    config: {
      animateOpen: true,
    },
  };

  componentDidMount() {
    this.renderJson();
  }

  componentDidUpdate() {
    this.renderJson();
  }

  renderJson = () => {
    const { json, config, open, onDidRender } = this.props;
    const wrapperEl = this.wrapperRef.current;
    const formatter = new JsonExplorer(json, open, config);
    const hasChildren: boolean = wrapperEl.hasChildNodes();
    if (hasChildren) {
      wrapperEl.replaceChild(formatter.render(), wrapperEl.lastChild);
    } else {
      wrapperEl.appendChild(formatter.render());
    }

    if (onDidRender) {
      onDidRender(formatter.json);
    }
  };

  render() {
    const { className } = this.props;
    return <div className={className} ref={this.wrapperRef} />;
  }
}
