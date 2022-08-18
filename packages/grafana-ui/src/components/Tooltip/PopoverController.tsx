import { Placement } from '@popperjs/core';
import { Component } from 'react';

import { PopoverContent } from './types';

type PopperControllerRenderProp = (
  showPopper: () => void,
  hidePopper: () => void,
  popperProps: {
    show: boolean;
    placement: Placement;
    content: PopoverContent;
  }
) => JSX.Element;

interface Props {
  placement?: Placement;
  content: PopoverContent;
  className?: string;
  children: PopperControllerRenderProp;
  hideAfter?: number;
}

interface State {
  show: boolean;
}

class PopoverController extends Component<Props, State> {
  private hideTimeout: any;
  state = { show: false };

  showPopper = () => {
    clearTimeout(this.hideTimeout);
    this.setState({ show: true });
  };

  hidePopper = () => {
    this.hideTimeout = setTimeout(() => {
      this.setState({ show: false });
    }, this.props.hideAfter);
  };

  render() {
    const { children, content, placement = 'auto' } = this.props;
    const { show } = this.state;

    return children(this.showPopper, this.hidePopper, {
      show,
      placement,
      content,
    });
  }
}

export { PopoverController };
