import React from 'react';
import ReactDOM from 'react-dom';
import Drop from 'tether-drop';
import { SeriesColorPickerPopover } from './SeriesColorPickerPopover';

export interface SeriesColorPickerProps {
  color: string;
  yaxis?: number;
  optionalClass?: string;
  onColorChange: (newColor: string) => void;
  onToggleAxis?: () => void;
}

export class SeriesColorPicker extends React.Component<SeriesColorPickerProps> {
  pickerElem: any;
  colorPickerDrop: any;

  static defaultProps = {
    optionalClass: '',
    yaxis: undefined,
    onToggleAxis: () => {},
  };

  constructor(props) {
    super(props);
  }

  componentWillUnmount() {
    this.destroyDrop();
  }

  onClickToOpen = () => {
    if (this.colorPickerDrop) {
      this.destroyDrop();
    }

    const { color, yaxis, onColorChange, onToggleAxis } = this.props;
    const dropContent = (
      <SeriesColorPickerPopover color={color} yaxis={yaxis} onColorChange={onColorChange} onToggleAxis={onToggleAxis} />
    );
    const dropContentElem = document.createElement('div');
    ReactDOM.render(dropContent, dropContentElem);

    const drop = new Drop({
      target: this.pickerElem,
      content: dropContentElem,
      position: 'bottom center',
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
  };

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
    const { optionalClass, children } = this.props;
    return (
      <div className={optionalClass} ref={e => (this.pickerElem = e)} onClick={this.onClickToOpen}>
        {children}
      </div>
    );
  }
}
