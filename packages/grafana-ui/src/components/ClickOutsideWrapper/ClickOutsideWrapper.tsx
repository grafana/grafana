import React, { PureComponent } from 'react';
import ReactDOM from 'react-dom';

export interface Props {
  onClick: () => void;
}

interface State {
  hasEventListener: boolean;
}

export class ClickOutsideWrapper extends PureComponent<Props, State> {
  state = {
    hasEventListener: false,
  };

  componentDidMount() {
    window.addEventListener('click', this.onOutsideClick, false);
    // Use keyup since keydown already has an eventlistener on window
    window.addEventListener('keyup', this.onOutsideClick, false);
  }

  componentWillUnmount() {
    window.removeEventListener('click', this.onOutsideClick, false);
    window.addEventListener('keyup', this.onOutsideClick, false);
  }

  onOutsideClick = (event: any) => {
    const domNode = ReactDOM.findDOMNode(this) as Element;

    if (!domNode || !domNode.contains(event.target)) {
      this.props.onClick();
    }
  };

  render() {
    return this.props.children;
  }
}
