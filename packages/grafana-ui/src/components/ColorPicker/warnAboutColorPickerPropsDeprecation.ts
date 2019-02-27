import propDeprecationWarning from '../../utils/propDeprecationWarning';
import { ColorPickerProps } from './ColorPickerPopover';

export const warnAboutColorPickerPropsDeprecation = (componentName: string, props: ColorPickerProps) => {
  const { onColorChange } = props;
  if (onColorChange) {
    propDeprecationWarning(componentName, 'onColorChange', 'onChange');
  }
};
