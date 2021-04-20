import React, { Component } from 'react';
import { SeriesColorPicker } from '../ColorPicker/ColorPicker';
import { SeriesIcon } from './SeriesIcon';

interface Props {
  disabled: boolean;
  color: string;
  onColorChange: (color: string) => void;
}

/**
 * @internal
 */
export class VizLegendSeriesIcon extends Component<Props> {
  shouldComponentUpdate(nextProps: Props) {
    if (this.props.color !== nextProps.color) {
      return true;
    }
    return this.props.disabled !== nextProps.disabled;
  }

  onColorChange = (color: string) => {
    this.props.onColorChange(color);
  };

  render() {
    const { disabled, color } = this.props;
    if (disabled) {
      return <SeriesIcon color={color} />;
    }
    console.log('RENDER series icon', color);

    return (
      <SeriesColorPicker color={color} onChange={this.onColorChange} enableNamedColors>
        {({ ref, showColorPicker, hideColorPicker }) => (
          <SeriesIcon
            color={color}
            className="pointer"
            ref={ref}
            onClick={showColorPicker}
            onMouseLeave={hideColorPicker}
          />
        )}
      </SeriesColorPicker>
    );
  }
}
