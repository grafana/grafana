import React, { useState, HTMLAttributes } from 'react';
import { PopoverContent } from '../Tooltip/Tooltip';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { ToolbarButtonVariant, ToolbarButton } from '../Button';
import { ClickOutsideWrapper } from '../ClickOutsideWrapper/ClickOutsideWrapper';
import { css } from 'emotion';
import { useStyles } from '../../themes/ThemeContext';
import { Menu, MenuItemsGroup } from '../Menu/Menu';

export interface Props<T> extends HTMLAttributes<HTMLButtonElement> {
  className?: string;
  options: Array<SelectableValue<T>>;
  value?: SelectableValue<T>;
  maxMenuHeight?: number;
  onChange: (item: SelectableValue<T>) => void;
  tooltipContent?: PopoverContent;
  narrow?: boolean;
  variant?: ToolbarButtonVariant;
}

/**
 * @internal
 * A temporary component until we have a proper dropdown component
 */
export const ButtonSelect = React.memo(<T,>(props: Props<T>) => {
  const { className, options, value, onChange, narrow, variant, ...restProps } = props;
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const styles = useStyles(getStyles);

  const onCloseMenu = () => {
    setIsOpen(false);
  };

  const onToggle = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setIsOpen(!isOpen);
  };

  const onChangeInternal = (item: SelectableValue<T>) => {
    onChange(item);
    setIsOpen(false);
  };

  const menuGroup: MenuItemsGroup = {
    items: options.map((item) => ({
      label: (item.label || item.value) as string,
      onClick: () => onChangeInternal(item),
      active: item.value === value?.value,
    })),
  };

  return (
    <>
      <ToolbarButton
        className={className}
        isOpen={isOpen}
        onClick={onToggle}
        narrow={narrow}
        variant={variant}
        {...restProps}
      >
        {value?.label || value?.value}
      </ToolbarButton>
      {isOpen && (
        <div className={styles.menuWrapper}>
          <ClickOutsideWrapper onClick={onCloseMenu} parent={document}>
            <Menu items={[menuGroup]} />
          </ClickOutsideWrapper>
        </div>
      )}
    </>
  );
});

ButtonSelect.displayName = 'ButtonSelect';

const getStyles = (theme: GrafanaTheme) => {
  return {
    wrapper: css`
      position: relative;
      display: inline-flex;
    `,
    menuWrapper: css`
      position: absolute;
      z-index: ${theme.zIndex.dropdown};
      top: ${theme.spacing.formButtonHeight + 1}px;
      right: 0;
    `,
  };
};
