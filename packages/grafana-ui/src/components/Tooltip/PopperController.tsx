import React from 'react';
import * as PopperJS from 'popper.js';

// This API allows popovers to update Popper's position when e.g. popover content chaanges
// updatePopperPosition is delivered to content by react-popper
export interface PopperContentProps  { updatePopperPosition?: () => void; }

export type PopperContent<T extends PopperContentProps> = string | React.ReactElement<T>;

export interface UsingPopperProps {
  show?: boolean;
  placement?: PopperJS.Placement;
  content: PopperContent<any>;
  children: JSX.Element;
}

type PopperControllerRenderProp = (
  showPopper: () => void,
  hidePopper: () => void,
  popperProps: {
    show: boolean;
    placement: PopperJS.Placement;
    content: PopperContent<any>;
  }
) => JSX.Element;

interface Props {
  placement?: PopperJS.Placement;
  content: PopperContent<any>;
  className?: string;
  children: PopperControllerRenderProp;
}

interface State {
  placement: PopperJS.Placement;
  show: boolean;
}

class PopperController extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      placement: this.props.placement || 'auto',
      show: false,
    };
  }

  componentWillReceiveProps(nextProps: Props) {
    if (nextProps.placement && nextProps.placement !== this.state.placement) {
      this.setState((prevState: State) => {
        return {
          ...prevState,
          placement: nextProps.placement || 'auto',
        };
      });
    }
  }

  showPopper = () => {
    this.setState(prevState => ({
      ...prevState,
      show: true,
    }));
  };

  hidePopper = () => {
    this.setState(prevState => ({
      ...prevState,
      show: false,
    }));
  };

  render() {
    const { children, content } = this.props;
    const { show, placement } = this.state;

    return children(this.showPopper, this.hidePopper, {
      show,
      placement,
      content,
    });
  }
}

export default PopperController;
