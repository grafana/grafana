import React, { useState, HTMLAttributes } from 'react';
import { PopoverContent } from '../Tooltip/Tooltip';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { ToolbarButtonVariant, ToolbarButton, ButtonGroup } from '../Button';
import { ClickOutsideWrapper } from '../ClickOutsideWrapper/ClickOutsideWrapper';
import { css } from '@emotion/css';
import { useStyles2 } from '../../themes/ThemeContext';
import { Menu } from '../Menu/Menu';
import { MenuItem } from '../Menu/MenuItem';
import { FocusScope } from '@react-aria/focus';

export interface Props<T> extends HTMLAttributes<HTMLButtonElement> {
  className?: string;
  options: Array<SelectableValue<T>>;
  value?: SelectableValue<T>;
  onChange: (item: SelectableValue<T>) => void;
  tooltipContent?: PopoverContent;
  narrow?: boolean;
  variant?: ToolbarButtonVariant;
}

/**
 * @internal
 * A temporary component until we have a proper dropdown component
 */
const ButtonSelectComponent = <T,>(props: Props<T>) => {
  const { className, options, value, onChange, narrow, variant, ...restProps } = props;
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const styles = useStyles2(getStyles);

  const onCloseMenu = () => {
    setIsOpen(false);
  };

  const onToggle = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setIsOpen(!isOpen);
  };

  const onArrowKeyDown = (event: React.KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === 'ArrowDown' || event.key === 'Enter') {
      setIsOpen(!isOpen);
    }
  };

  const onChangeInternal = (item: SelectableValue<T>) => {
    onChange(item);
    setIsOpen(false);
  };

  return (
    <ButtonGroup className={styles.wrapper}>
      <ToolbarButton
        className={className}
        isOpen={isOpen}
        onClick={onToggle}
        onKeyDown={onArrowKeyDown}
        narrow={narrow}
        variant={variant}
        {...restProps}
      >
        {value?.label || value?.value}
      </ToolbarButton>
      {isOpen && (
        <div className={styles.menuWrapper}>
          <ClickOutsideWrapper onClick={onCloseMenu} parent={document} includeButtonPress={false}>
            <FocusScope contain autoFocus restoreFocus>
              <Menu onClose={onCloseMenu}>
                {options.map((item) => (
                  <MenuItem
                    key={`${item.value}`}
                    label={(item.label || item.value) as string}
                    onClick={() => onChangeInternal(item)}
                    active={item.value === value?.value}
                    ariaChecked={item.value === value?.value}
                    ariaLabel={item.ariaLabel || item.label}
                    role="menuitemradio"
                  />
                ))}
              </Menu>
            </FocusScope>
          </ClickOutsideWrapper>
        </div>
      )}
    </ButtonGroup>
  );
};

ButtonSelectComponent.displayName = 'ButtonSelect';

export const ButtonSelect = React.memo(ButtonSelectComponent) as typeof ButtonSelectComponent;

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css`
      position: relative;
      display: inline-flex;
    `,
    menuWrapper: css`
      position: absolute;
      z-index: ${theme.zIndex.dropdown};
      top: ${theme.spacing(4)};
      right: 0;
    `,
  };
};
