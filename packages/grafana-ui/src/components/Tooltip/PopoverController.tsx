import React from 'react';
import * as PopperJS from 'popper.js';
import { PopoverContent } from './Tooltip';

// This API allows popovers to update Popper's position when e.g. popover content changes
// updatePopperPosition is delivered to content by react-popper

export interface UsingPopperProps {
  show?: boolean;
  placement?: TooltipPlacement;
  content: PopoverContent;
  children: JSX.Element;
}

export type TooltipPlacement =
  | 'auto-start'
  | 'auto'
  | 'auto-end'
  | 'top-start'
  | 'top'
  | 'top-end'
  | 'right-start'
  | 'right'
  | 'right-end'
  | 'bottom-end'
  | 'bottom'
  | 'bottom-start'
  | 'left-end'
  | 'left'
  | 'left-start';

type PopperControllerRenderProp = (
  showPopper: () => void,
  hidePopper: () => void,
  popperProps: {
    show: boolean;
    placement: PopperJS.Placement;
    content: PopoverContent;
  }
) => JSX.Element;

interface Props {
  placement?: PopperJS.Placement;
  content: PopoverContent;
  className?: string;
  children: PopperControllerRenderProp;
  hideAfter?: number;
}

interface State {
  show: boolean;
}

class PopoverController extends React.Component<Props, State> {
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
