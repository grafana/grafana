import { SeriesColorPickerPopover } from './SeriesColorPickerPopover';
import { ColorPickerProps, colorPickerFactory } from './ColorPicker';

export interface SeriesColorPickerProps extends ColorPickerProps {
  yaxis?: number;
  optionalClass?: string;
  onToggleAxis?: () => void;
  children: JSX.Element;
}

export default colorPickerFactory(SeriesColorPickerPopover ,'SeriesColorPicker')
