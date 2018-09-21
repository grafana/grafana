import React from 'react';
import { ColorPickerPopover } from './ColorPickerPopover';
import { react2AngularDirective } from 'app/core/utils/react2angular';

export interface Props {
  series: any;
  onColorChange: (color: string) => void;
  onToggleAxis: () => void;
}

export class SeriesColorPicker extends React.Component<Props, any> {
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

  renderAxisSelection() {
    const leftButtonClass = this.props.series.yaxis === 1 ? 'btn-success' : 'btn-inverse';
    const rightButtonClass = this.props.series.yaxis === 2 ? 'btn-success' : 'btn-inverse';

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

  render() {
    return (
      <div className="graph-legend-popover">
        {this.props.series.yaxis && this.renderAxisSelection()}
        <ColorPickerPopover color={this.props.series.color} onColorSelect={this.onColorChange} />
      </div>
    );
  }
}

react2AngularDirective('seriesColorPicker', SeriesColorPicker, ['series', 'onColorChange', 'onToggleAxis']);
