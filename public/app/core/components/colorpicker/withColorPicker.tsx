import React from 'react';
import ReactDOM from 'react-dom';
import Drop from 'tether-drop';
import { SeriesColorPicker } from './SeriesColorPicker';

export interface WithSeriesColorPickerProps {
  color: string;
  yaxis?: number;
  optionalClass?: string;
  onColorChange: (newColor: string) => void;
  onToggleAxis?: () => void;
}

export default function withSeriesColorPicker(WrappedComponent) {
  return class extends React.Component<WithSeriesColorPickerProps, any> {
    pickerElem: any;
    colorPickerDrop: any;

    static defaultProps = {
      optionalClass: '',
      yaxis: undefined,
      onToggleAxis: () => {},
    };

    constructor(props) {
      super(props);
      this.openColorPicker = this.openColorPicker.bind(this);
    }

    openColorPicker() {
      if (this.colorPickerDrop) {
        this.destroyDrop();
      }

      const { color, yaxis, onColorChange, onToggleAxis } = this.props;
      const dropContent = (
        <SeriesColorPicker color={color} yaxis={yaxis} onColorChange={onColorChange} onToggleAxis={onToggleAxis} />
      );
      const dropContentElem = document.createElement('div');
      ReactDOM.render(dropContent, dropContentElem);

      const drop = new Drop({
        target: this.pickerElem,
        content: dropContentElem,
        position: 'top center',
        classes: 'drop-popover',
        openOn: 'hover',
        hoverCloseDelay: 200,
        remove: true,
        tetherOptions: {
          constraints: [{ to: 'scrollParent', attachment: 'none both' }],
        },
      });

      drop.on('close', this.closeColorPicker.bind(this));

      this.colorPickerDrop = drop;
      this.colorPickerDrop.open();
    }

    closeColorPicker() {
      setTimeout(() => {
        this.destroyDrop();
      }, 100);
    }

    destroyDrop() {
      if (this.colorPickerDrop && this.colorPickerDrop.tether) {
        this.colorPickerDrop.destroy();
        this.colorPickerDrop = null;
      }
    }

    render() {
      const { optionalClass, onColorChange, ...wrappedComponentProps } = this.props;
      return (
        <div className={optionalClass} ref={e => (this.pickerElem = e)} onClick={this.openColorPicker}>
          <WrappedComponent {...wrappedComponentProps} />
        </div>
      );
    }
  };
}
