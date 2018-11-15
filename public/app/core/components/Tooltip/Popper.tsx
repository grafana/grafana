import React, { PureComponent } from 'react';
import { Manager, Popper as ReactPopper, Reference } from 'react-popper';

interface Props {
  renderContent: (content: any) => any;
  show: boolean;
  placement?: any;
  content: string | ((props: any) => JSX.Element);
  refClassName?: string;
}

class Popper extends PureComponent<Props> {
  render() {
    const { children, renderContent, show, placement, refClassName } = this.props;
    const { content } = this.props;
    return (
      <Manager>
        <Reference>
          {({ ref }) => (
            <div className={`popper_ref ${refClassName || ''}`} ref={ref}>
              {children}
            </div>
          )}
        </Reference>
        {show && (
          <ReactPopper placement={placement}>
            {({ ref, style, placement, arrowProps }) => {
              return (
                <div ref={ref} style={style} data-placement={placement} className="popper">
                  <div className="popper__background">
                    {renderContent(content)}
                    <div ref={arrowProps.ref} data-placement={placement} className="popper__arrow" />
                  </div>
                </div>
              );
            }}
          </ReactPopper>
        )}
      </Manager>
    );
  }
}

export default Popper;
