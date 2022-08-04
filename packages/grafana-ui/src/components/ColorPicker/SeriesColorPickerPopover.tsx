import { css } from '@emotion/css';
import React, { FunctionComponent, PureComponent } from 'react';

import { withTheme2, useStyles } from '../../themes';
import { Button } from '../Button';
import { Switch } from '../Forms/Legacy/Switch/Switch';
import { PopoverContentProps } from '../Tooltip';

import { ColorPickerPopover, ColorPickerProps } from './ColorPickerPopover';

export interface SeriesColorPickerPopoverProps extends ColorPickerProps, PopoverContentProps {
  yaxis?: number;
  onToggleAxis?: () => void;
}

export const SeriesColorPickerPopover: FunctionComponent<SeriesColorPickerPopoverProps> = (props) => {
  const styles = useStyles(getStyles);
  const { yaxis, onToggleAxis, color, ...colorPickerProps } = props;

  const customPickers = onToggleAxis
    ? {
        yaxis: {
          name: 'Y-Axis',
          tabComponent() {
            return (
              <Switch
                key="yaxisSwitch"
                label="Use right y-axis"
                className={styles.colorPickerAxisSwitch}
                labelClass={styles.colorPickerAxisSwitchLabel}
                checked={yaxis === 2}
                onChange={() => {
                  if (onToggleAxis) {
                    onToggleAxis();
                  }
                }}
              />
            );
          },
        },
      }
    : undefined;
  return <ColorPickerPopover {...colorPickerProps} color={color || '#000000'} customPickers={customPickers} />;
};

interface AxisSelectorProps {
  yaxis: number;
  onToggleAxis?: () => void;
}

interface AxisSelectorState {
  yaxis: number;
}

export class AxisSelector extends PureComponent<AxisSelectorProps, AxisSelectorState> {
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
    const leftButtonVariant = this.state.yaxis === 1 ? 'primary' : 'secondary';
    const rightButtonVariant = this.state.yaxis === 2 ? 'primary' : 'secondary';

    return (
      <div className="p-b-1">
        <label className="small p-r-1">Y Axis:</label>
        <Button onClick={this.onToggleAxis} size="sm" variant={leftButtonVariant}>
          Left
        </Button>
        <Button onClick={this.onToggleAxis} size="sm" variant={rightButtonVariant}>
          Right
        </Button>
      </div>
    );
  }
}

// This component is to enable SeriesColorPickerPopover usage via series-color-picker-popover directive
export const SeriesColorPickerPopoverWithTheme = withTheme2(SeriesColorPickerPopover);

const getStyles = () => {
  return {
    colorPickerAxisSwitch: css`
      width: 100%;
    `,
    colorPickerAxisSwitchLabel: css`
      display: flex;
      flex-grow: 1;
    `,
  };
};
