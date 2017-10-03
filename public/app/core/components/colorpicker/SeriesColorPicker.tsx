import React from 'react';
import coreModule from 'app/core/core_module';
import { ColorPickerPopover } from './ColorPickerPopover';

export interface IProps {
  series: any;
  onColorChange: (color: string) => void;
  onToggleAxis: () => void;
}

export class SeriesColorPicker extends React.Component<IProps, any> {
  constructor(props) {
    super(props);
    this.onColorChange = this.onColorChange.bind(this);
    this.onToggleAxis = this.onToggleAxis.bind(this);
  }

  onColorChange(color) {
    this.props.onColorChange(color);
  }

  onToggleAxis() {
    this.props.onToggleAxis();
  }

  render() {
    const leftButtonClass = this.props.series.yaxis === 1 ? 'btn-success' : 'btn-inverse';
    const rightButtonClass = this.props.series.yaxis === 2 ? 'btn-success' : 'btn-inverse';

    return (
      <div className="graph-legend-popover">
        <div className="p-b-1">
          <label>Y Axis:</label>
          <button onClick={this.onToggleAxis} className={"btn btn-small " + leftButtonClass}>
            Left
          </button>
          <button onClick={this.onToggleAxis} className={"btn btn-small " + rightButtonClass}>
            Right
          </button>
        </div>
        <ColorPickerPopover color={this.props.series.color} onColorSelect={this.onColorChange} />
      </div>
    );
  }
}

coreModule.directive('seriesColorPicker', function (reactDirective) {
  return reactDirective(SeriesColorPicker, ['series', 'onColorChange', 'onToggleAxis']);
});
