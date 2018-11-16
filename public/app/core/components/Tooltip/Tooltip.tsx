import React, { PureComponent } from 'react';
import Popper from './Popper';
import withPopper, { UsingPopperProps } from './withPopper';

class Tooltip extends PureComponent<UsingPopperProps> {
  render() {
    const { children, hidePopper, showPopper, className, ...restProps } = this.props;

    return (
      <div className={`popper__manager ${className}`} onMouseEnter={showPopper} onMouseLeave={hidePopper}>
        <Popper {...restProps}>{children}</Popper>
      </div>
    );
  }
}

export default withPopper(Tooltip);
