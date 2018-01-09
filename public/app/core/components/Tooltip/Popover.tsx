import React from 'react';
import withTooltip from './withTooltip';

interface IPopoverProps {
  tooltipSetState: (prevState: object) => void;
}

class Popover extends React.Component<IPopoverProps, any> {
  constructor(props) {
    super(props);
    this.toggleTooltip = this.toggleTooltip.bind(this);
  }

  toggleTooltip() {
    const { tooltipSetState } = this.props;
    tooltipSetState(prevState => {
      return {
        ...prevState,
        show: !prevState.show,
      };
    });
  }

  render() {
    return <span onClick={this.toggleTooltip}>{this.props.children}</span>;
  }
}

export default withTooltip(Popover);
