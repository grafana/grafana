import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { Button } from '../Button/Button';
import { TreeSelectBase } from '../Cascader/TreeSelectImplementation';
import { type CascaderOption } from '../Cascader/types';
import { Icon } from '../Icon/Icon';

import { type ButtonCascaderProps, type CascaderFieldNames } from './types';

export type { ButtonCascaderProps, CascaderFieldNames } from './types';

function isCascaderOptionArray(value: CascaderOption[keyof CascaderOption]): value is CascaderOption[] {
  return Array.isArray(value);
}

function mapOptions(options: CascaderOption[], fieldNames: CascaderFieldNames<CascaderOption> = {}): CascaderOption[] {
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
      children: isCascaderOptionArray(rawChildren) ? mapOptions(rawChildren, fieldNames) : undefined,
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
  const styles = useStyles2(getStyles);
  const mappedOptions = mapOptions(options, fieldNames);

  return (
    <TreeSelectBase
      options={mappedOptions}
      valuePath={value}
      onSelect={() => {}}
      onChangePath={(values, selectedOptions) => onChange?.(values, publicOptions(selectedOptions))}
      loadData={(selectedOptions) => loadData?.(publicOptions(selectedOptions))}
      onOpenChange={onPopupVisibleChange}
      className={className}
      disabled={disabled}
      renderTrigger={(triggerProps) => {
        const { onClick, ref, ...rest } = triggerProps;
        return (
          <Button
            icon={icon}
            disabled={disabled}
            variant={variant}
            {...(buttonProps ?? {})}
            {...rest}
            ref={ref}
            onClick={(event) => {
              buttonProps?.onClick?.(event);
              if (!event.defaultPrevented) {
                onClick?.(event);
              }
            }}
          >
            {children}
            {!hideDownIcon && <Icon name="angle-down" className={styles.icon} />}
          </Button>
        );
      }}
    />
  );
};

ButtonCascader.displayName = 'ButtonCascader';

const getStyles = (theme: GrafanaTheme2) => ({
  icon: css({
    margin: theme.spacing(0, 0, 0, 0.5),
  }),
});
