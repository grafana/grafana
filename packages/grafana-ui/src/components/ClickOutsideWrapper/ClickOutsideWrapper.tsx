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
}

interface State {
  hasEventListener: boolean;
}

export class ClickOutsideWrapper extends PureComponent<Props, State> {
  static defaultProps = {
    includeButtonPress: true,
  };
  state = {
    hasEventListener: false,
  };

  componentDidMount() {
    document.addEventListener('mousedown', this.onOutsideClick, false);
    if (this.props.includeButtonPress) {
      document.addEventListener('keydown', this.onOutsideClick, false);
    }
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.onOutsideClick, false);
    if (this.props.includeButtonPress) {
      document.removeEventListener('keydown', this.onOutsideClick, false);
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
