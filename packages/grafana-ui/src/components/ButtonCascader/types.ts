import { type IconName } from '../../types/icon';
import { type ButtonProps } from '../Button/Button';
import { type CascaderOption } from '../Cascader/types';

export interface CascaderFieldNames<Option> {
  label?: keyof Option;
  value?: keyof Option;
  children?: keyof Option;
}

export interface ButtonCascaderProps {
  options: CascaderOption[];
  children: string;
  icon?: IconName;
  disabled?: boolean;
  value?: string[];
  fieldNames?: CascaderFieldNames<CascaderOption>;
  loadData?: (selectedOptions: CascaderOption[]) => void;
  onChange?: (value: string[], selectedOptions: CascaderOption[]) => void;
  onPopupVisibleChange?: (visible: boolean) => void;
  className?: string;
  variant?: ButtonProps['variant'];
  buttonProps?: Omit<ButtonProps, 'children'>;
  hideDownIcon?: boolean;
}
