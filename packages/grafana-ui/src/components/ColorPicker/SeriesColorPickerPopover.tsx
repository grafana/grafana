import React, { FunctionComponent } from 'react';
import { ColorPickerPopover } from './ColorPickerPopover';
import { Themeable } from '../../types';
import { ColorPickerProps } from './ColorPicker';

export interface SeriesColorPickerPopoverProps extends ColorPickerProps, Themeable {
  yaxis?: number;
  onToggleAxis?: () => void;
}

export const SeriesColorPickerPopover: FunctionComponent<SeriesColorPickerPopoverProps> = ({
  onChange,
  color,
  theme,
  yaxis,
  onToggleAxis,
}) => {
  return (
    <ColorPickerPopover theme={theme} color={color} onChange={onChange}>
      <div style={{ marginTop: '32px' }}>{yaxis && <AxisSelector yaxis={yaxis} onToggleAxis={onToggleAxis} />}</div>
    </ColorPickerPopover>
  );
};

interface AxisSelectorProps {
  yaxis: number;
  onToggleAxis?: () => void;
}

interface AxisSelectorState {
  yaxis: number;
}

export class AxisSelector extends React.PureComponent<AxisSelectorProps, AxisSelectorState> {
  constructor(props: AxisSelectorProps) {
    super(props);
    this.state = {
      yaxis: this.props.yaxis,
    };
    this.onToggleAxis = this.onToggleAxis.bind(this);
  }

  onToggleAxis() {
    this.setState({
      yaxis: this.state.yaxis === 2 ? 1 : 2,
    });

    if (this.props.onToggleAxis) {
      this.props.onToggleAxis();
    }
  }

  render() {
    const leftButtonClass = this.state.yaxis === 1 ? 'btn-success' : 'btn-inverse';
    const rightButtonClass = this.state.yaxis === 2 ? 'btn-success' : 'btn-inverse';

    return (
      <div className="p-b-1">
        <label className="small p-r-1">Y Axis:</label>
        <button onClick={this.onToggleAxis} className={'btn btn-small ' + leftButtonClass}>
          Left
        </button>
        <button onClick={this.onToggleAxis} className={'btn btn-small ' + rightButtonClass}>
          Right
        </button>
      </div>
    );
  }
}
