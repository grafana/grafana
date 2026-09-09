import { type IconName } from '../../types/icon';
import { Button, type ButtonProps } from '../Button/Button';
import { TreeSelectBase } from '../Cascader/TreeSelectImplementation';
import { type CascaderOption } from '../Cascader/types';
import { Icon } from '../Icon/Icon';

interface CascaderFieldNames {
  label?: keyof CascaderOption;
  value?: keyof CascaderOption;
  children?: keyof CascaderOption;
}

export interface ButtonCascaderProps {
  options: CascaderOption[];
  children: string;
  icon?: IconName;
  disabled?: boolean;
  value?: string[];
  fieldNames?: CascaderFieldNames;
  loadData?: (selectedOptions: CascaderOption[]) => void;
  onChange?: (value: string[], selectedOptions: CascaderOption[]) => void;
  onPopupVisibleChange?: (visible: boolean) => void;
  className?: string;
  variant?: ButtonProps['variant'];
  buttonProps?: Omit<ButtonProps, 'children'>;
  hideDownIcon?: boolean;
}

function mapOptions(options: CascaderOption[], fieldNames: CascaderFieldNames): CascaderOption[] {
  const labelField = fieldNames.label ?? 'label';
  const valueField = fieldNames.value ?? 'value';
  const childrenField = fieldNames.children ?? 'children';

  return options.map((option) => {
    const rawValue = option[valueField];
    const value = rawValue == null ? '' : String(rawValue);
    const rawLabel = option[labelField];
    const rawChildren = option[childrenField];

    return {
      label: typeof rawLabel === 'string' ? rawLabel : value,
      value,
      disabled: option.disabled,
      isLeaf: option.isLeaf,
      children: Array.isArray(rawChildren) ? mapOptions(rawChildren, fieldNames) : undefined,
    };
  });
}

function publicOptions(options: CascaderOption[]): CascaderOption[] {
  return options.map(({ label, value }) => ({ label, value }));
}

/**
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-buttoncascader--docs
 */
export const ButtonCascader = ({
  options,
  children,
  icon,
  disabled,
  value,
  fieldNames,
  loadData,
  onChange,
  onPopupVisibleChange,
  className,
  variant,
  buttonProps,
  hideDownIcon,
}: ButtonCascaderProps) => {
  const mappedOptions = fieldNames ? mapOptions(options, fieldNames) : options;

  return (
    <TreeSelectBase
      options={mappedOptions}
      valuePath={value}
      onChangePath={(values, selectedOptions) => onChange?.(values, publicOptions(selectedOptions))}
      loadData={(selectedOptions) => loadData?.(publicOptions(selectedOptions))}
      onOpenChange={onPopupVisibleChange}
      className={className}
      disabled={disabled}
      renderTrigger={({ onClick, ...triggerProps }) => (
        <Button
          icon={icon}
          disabled={disabled}
          variant={variant}
          {...buttonProps}
          {...triggerProps}
          onClick={(event) => {
            buttonProps?.onClick?.(event);
            if (!event.defaultPrevented) {
              onClick(event);
            }
          }}
        >
          {children}
          {!hideDownIcon && <Icon name="angle-down" style={{ marginLeft: 4 }} />}
        </Button>
      )}
    />
  );
};
