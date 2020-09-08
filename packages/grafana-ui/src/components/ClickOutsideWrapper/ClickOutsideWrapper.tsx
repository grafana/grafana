import { PureComponent } from 'react';
import ReactDOM from 'react-dom';

export interface Props {
  /**
   *  Callback to trigger when clicking outside of current element occurs.
   */
  onClick: () => void;
  /**
   *  Runs the 'onClick' function when pressing a key outside of the current element. Defaults to true.
   */
  includeButtonPress: boolean;
  /** Object to attach the click event listener to. */
  parent: Window | Document;
  /**
   * https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener. Defaults to false.
   */
  useCapture?: boolean;
}

interface State {
  hasEventListener: boolean;
}

export class ClickOutsideWrapper extends PureComponent<Props, State> {
  static defaultProps = {
    includeButtonPress: true,
    parent: window,
    useCapture: false,
  };
  state = {
    hasEventListener: false,
  };

  componentDidMount() {
    this.props.parent.addEventListener('click', this.onOutsideClick, this.props.useCapture);
    if (this.props.includeButtonPress) {
      // Use keyup since keydown already has an event listener on window
      this.props.parent.addEventListener('keyup', this.onOutsideClick, this.props.useCapture);
    }
  }

  componentWillUnmount() {
    this.props.parent.removeEventListener('click', this.onOutsideClick, this.props.useCapture);
    if (this.props.includeButtonPress) {
      this.props.parent.removeEventListener('keyup', this.onOutsideClick, this.props.useCapture);
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
