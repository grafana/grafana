import React, { PureComponent } from 'react';
import withTooltip from './withTooltip';
import { Target } from 'react-popper';

interface Props {
  tooltipSetState: (prevState: object) => void;
}

class Tooltip extends PureComponent<Props> {
  showTooltip = () => {
    const { tooltipSetState } = this.props;

    tooltipSetState(prevState => ({
      ...prevState,
      show: true,
    }));
  };

  hideTooltip = () => {
    const { tooltipSetState } = this.props;
    tooltipSetState(prevState => ({
      ...prevState,
      show: false,
    }));
  };

  render() {
    return (
      <Target className="popper__target" onMouseOver={this.showTooltip} onMouseOut={this.hideTooltip}>
        {this.props.children}
      </Target>
    );
  }
}

export default withTooltip(Tooltip);
