import React from 'react';
import withTooltip from './withTooltip';

interface ITooltipProps {
  tooltipSetState: (prevState: object) => void;
}

class Tooltip extends React.Component<ITooltipProps, any> {
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
      <span onMouseOver={this.showTooltip} onMouseOut={this.hideTooltip}>
        {this.props.children}
      </span>
    );
  }
}

export default withTooltip(Tooltip);
