import React, { FunctionComponent } from 'react';

import { ColorPickerPopover, ColorPickerProps } from './ColorPickerPopover';
import { PopoverContentProps } from '../Tooltip/Tooltip';
import { Switch } from '../Switch/Switch';
import { withTheme } from '../../themes/ThemeContext';

export interface SeriesColorPickerPopoverProps extends ColorPickerProps, PopoverContentProps {
  yaxis?: number;
  onToggleAxis?: () => void;
}

export const SeriesColorPickerPopover: FunctionComponent<SeriesColorPickerPopoverProps> = props => {
  const { yaxis, onToggleAxis, color, ...colorPickerProps } = props;
  return (
    <ColorPickerPopover
      {...colorPickerProps}
      color={color || '#000000'}
      customPickers={{
        yaxis: {
          name: 'Y-Axis',
          tabComponent: () => (
            <Switch
              key="yaxisSwitch"
              label="Use right y-axis"
              className="ColorPicker__axisSwitch"
              labelClass="ColorPicker__axisSwitchLabel"
              checked={yaxis === 2}
              onChange={() => {
                if (onToggleAxis) {
                  onToggleAxis();
                }
              }}
            />
          ),
        },
      }}
    />
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
    const leftButtonClass = this.state.yaxis === 1 ? 'btn-primary' : 'btn-inverse';
    const rightButtonClass = this.state.yaxis === 2 ? 'btn-primary' : 'btn-inverse';

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

// This component is to enable SeriecColorPickerPopover usage via series-color-picker-popover directive
export const SeriesColorPickerPopoverWithTheme = withTheme(SeriesColorPickerPopover);
