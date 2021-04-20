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
return this.props.color !== nextProps.color || this.props.disabled !== nextProps.disabled;
  }

  render() {
    const { disabled, color } = this.props;
    if (disabled) {
      return <SeriesIcon color={color} />;
    }
    return (
      <SeriesColorPicker color={color} onChange={this.props.onColorChange} enableNamedColors>
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
