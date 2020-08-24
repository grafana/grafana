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
    useCapture: false,
  };
  state = {
    hasEventListener: false,
  };

  componentDidMount() {
    document.addEventListener('click', this.onOutsideClick, this.props.useCapture);
    if (this.props.includeButtonPress) {
      // Use keyup since keydown already has an eventlistener on window
      document.addEventListener('keyup', this.onOutsideClick, this.props.useCapture);
    }
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.onOutsideClick, this.props.useCapture);
    if (this.props.includeButtonPress) {
      document.removeEventListener('keyup', this.onOutsideClick, this.props.useCapture);
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
