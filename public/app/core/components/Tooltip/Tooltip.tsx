import React from 'react';
import { Manager, Target, Popper, Arrow } from 'react-popper';

interface ITooltipProps {
  placement: any;
  content: any;
}

export class Tooltip extends React.Component<ITooltipProps, any> {
  constructor(props) {
    super(props);
    this.handleMouseOver = this.handleMouseOver.bind(this);
    this.handleMouseOut = this.handleMouseOut.bind(this);
    this.state = {
      placement: this.props.placement || 'auto',
      show: false,
    };
  }

  handleMouseOver() {
    this.setState(prevState => {
      return {
        ...prevState,
        show: true,
      };
    });
  }

  handleMouseOut() {
    this.setState(prevState => {
      return {
        ...prevState,
        show: false,
      };
    });
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.placement !== this.state.placement) {
      this.setState(prevState => {
        return {
          ...prevState,
          placement: nextProps.placement,
        };
      });
    }
  }

  renderContent(content) {
    if (typeof content === 'function') {
      // If it's a function we assume it's a React component
      const ReactComponent = content;
      return <ReactComponent />;
    }
    return content;
  }

  render() {
    const { content } = this.props;
    return (
      <Manager className="popper__manager">
        <Target className="popper__target">
          <span onMouseOver={this.handleMouseOver} onMouseOut={this.handleMouseOut}>
            {this.props.children}
          </span>
        </Target>
        {this.state.show ? (
          <Popper placement={this.state.placement} className="popper">
            {this.renderContent(content)}
            <Arrow className="popper__arrow" />
          </Popper>
        ) : null}
      </Manager>
    );
  }
}
