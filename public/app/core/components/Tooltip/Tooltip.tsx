import React from 'react';
import withTooltip from './withTooltip';
import { Target } from 'react-popper';

interface TooltipProps {
  tooltipSetState: (prevState: object) => void;
}

class Tooltip extends React.Component<TooltipProps, any> {
  constructor(props) {
    super(props);
    this.showTooltip = this.showTooltip.bind(this);
    this.hideTooltip = this.hideTooltip.bind(this);
  }

  showTooltip() {
    const { tooltipSetState } = this.props;
    tooltipSetState(prevState => {
      return {
        ...prevState,
        show: true,
      };
    });
  }

  hideTooltip() {
    const { tooltipSetState } = this.props;
    tooltipSetState(prevState => {
      return {
        ...prevState,
        show: false,
      };
    });
  }

  render() {
    return (
      <Target className="popper__target" onMouseOver={this.showTooltip} onMouseOut={this.hideTooltip}>
        {this.props.children}
      </Target>
    );
  }
}

export default withTooltip(Tooltip);
