import React, { PureComponent } from 'react';
import ReactDOM from 'react-dom';

interface Props {
  className?: string;
  root?: HTMLElement;
}

export class Portal extends PureComponent<Props> {
  node: HTMLElement = document.createElement('div');
  portalRoot: HTMLElement;

  constructor(props: Props) {
    super(props);
    const { className, root = document.body } = this.props;

    if (className) {
      this.node.classList.add(className);
    }

    this.portalRoot = root;
    this.portalRoot.appendChild(this.node);
  }

  componentWillUnmount() {
    this.portalRoot.removeChild(this.node);
  }

  render() {
    // Default z-index is high to make sure
    return ReactDOM.createPortal(
      <div style={{ zIndex: 1051, position: 'relative' }}>{this.props.children}</div>,
      this.node
    );
  }
}
