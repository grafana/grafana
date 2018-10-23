import React from 'react';
import withTooltip from './withTooltip';
import { Target } from 'react-popper';

interface PopoverProps {
  tooltipSetState: (prevState: object) => void;
}

class Popover extends React.Component<PopoverProps, any> {
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
    return (
      <Target className="popper__target" onClick={this.toggleTooltip}>
        {this.props.children}
      </Target>
    );
  }
}

export default withTooltip(Popover);
