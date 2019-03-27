import React, { CSSProperties, MouseEvent } from 'react';
import { DisplayValue } from '../../types/index';

interface Props {
  value: DisplayValue;
  children: JSX.Element;
}

interface State {
  hover: boolean;
  x: number;
  y: number;
}

/*
  Experimental (POC) component
 */
export class DisplayValueLink extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hover: false,
      x: 0,
      y: 0,
    };
  }

  onMouseMove = (evt: MouseEvent) => {
    if (this.props.value.tooltip) {
      this.setState({ hover: true, x: evt.pageX, y: evt.pageY });
    }
  };

  onMouseLeave = () => {
    if (this.props.value.tooltip) {
      this.setState({ hover: false });
    }
  };

  renderTooltip = () => {
    const { x, y } = this.state;
    const style: CSSProperties = {
      top: y - 25,
      left: x + 20,
    };
    return (
      <div style={style} className="display-value-tooltip">
        {this.props.value.tooltip}
      </div>
    );
  };

  render() {
    const { value, children } = this.props;
    const { tooltip, link, linkNewWindow } = value;

    if (!tooltip && !link) {
      return children;
    }

    const { hover } = this.state;
    const isHref = typeof link === 'string';
    return (
      <>
        {hover && this.renderTooltip()}

        {isHref ? (
          <a
            className="display-value-link"
            href={link as string}
            target={linkNewWindow ? '_blank' : undefined}
            onMouseMove={this.onMouseMove}
            onMouseLeave={this.onMouseLeave}
          >
            {children}
          </a>
        ) : (
          <div
            className="display-value-link"
            onClick={link as any}
            onMouseMove={this.onMouseMove}
            onMouseLeave={this.onMouseLeave}
          >
            {children}
          </div>
        )}
      </>
    );
  }
}
