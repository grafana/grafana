import { PureComponent } from 'react';
import ReactDOM from 'react-dom';

interface Props {
  className?: string;
}

export default class BodyPortal extends PureComponent<Props> {
  node: HTMLElement = document.createElement('div');
  portalRoot = document.body;

  constructor(props) {
    super(props);
    const { className } = this.props;
    if (className) {
      this.node.classList.add();
    }
    this.portalRoot.appendChild(this.node);
  }

  componentWillUnmount() {
    this.portalRoot.removeChild(this.node);
  }

  render() {
    return ReactDOM.createPortal(this.props.children, this.node);
  }
}
