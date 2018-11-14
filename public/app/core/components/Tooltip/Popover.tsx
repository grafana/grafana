import React, { PureComponent } from 'react';
import Popper from './Popper';
import withPopper, { UsingPopperProps } from './withPopper';

class Popover extends PureComponent<UsingPopperProps> {
  render() {
    const { children, hidePopper, showPopper, className, ...restProps } = this.props;

    const togglePopper = restProps.show === true ? hidePopper : showPopper;

    return (
      <div className={`popper__manager ${className}`} onClick={togglePopper}>
        <Popper {...restProps}>{children}</Popper>
      </div>
    );
  }
}

export default withPopper(Popover);
