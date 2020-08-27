import { PureComponent } from 'react';
import ReactDOM from 'react-dom';

export interface Props {
  /**
   *  When clicking outside of current element
   */
  onClick: () => void;
  /**
   *  Runs the 'onClick' function when pressing a key outside of the current element. Defaults to true.
   */
  includeButtonPress: boolean;
  parent: Window | Document;
}

interface State {
  hasEventListener: boolean;
}

export class ClickOutsideWrapper extends PureComponent<Props, State> {
  static defaultProps = {
    includeButtonPress: true,
    parent: window,
  };
  state = {
    hasEventListener: false,
  };

  componentDidMount() {
    this.props.parent.addEventListener('click', this.onOutsideClick, false);
    if (this.props.includeButtonPress) {
      // Use keyup since keydown already has an eventlistener on window
      this.props.parent.addEventListener('keyup', this.onOutsideClick, false);
    }
  }

  componentWillUnmount() {
    this.props.parent.removeEventListener('click', this.onOutsideClick, false);
    if (this.props.includeButtonPress) {
      this.props.parent.removeEventListener('keyup', this.onOutsideClick, false);
    }
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
