import { css } from '@emotion/css';
import { useButton } from '@react-aria/button';
import { FocusScope } from '@react-aria/focus';
import { useMenuTrigger } from '@react-aria/menu';
import { useMenuTriggerState } from '@react-stately/menu';
import React, { HTMLAttributes } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { ButtonGroup } from '../Button';
import { ClickOutsideWrapper } from '../ClickOutsideWrapper/ClickOutsideWrapper';
import { Menu } from '../Menu/Menu';
import { MenuItem } from '../Menu/MenuItem';
import { ToolbarButton, ToolbarButtonVariant } from '../ToolbarButton';
import { PopoverContent } from '../Tooltip';

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
  const styles = useStyles2(getStyles);
  const state = useMenuTriggerState({});

  const ref = React.useRef(null);
  const { menuTriggerProps, menuProps } = useMenuTrigger({}, state, ref);
  const { buttonProps } = useButton(menuTriggerProps, ref);

  const onChangeInternal = (item: SelectableValue<T>) => {
    onChange(item);
    state.close();
  };

  return (
    <ButtonGroup className={styles.wrapper}>
      <ToolbarButton
        className={className}
        isOpen={state.isOpen}
        narrow={narrow}
        variant={variant}
        ref={ref}
        {...buttonProps}
        {...restProps}
      >
        {value?.label || (value?.value != null ? String(value?.value) : null)}
      </ToolbarButton>
      {state.isOpen && (
        <div className={styles.menuWrapper}>
          <ClickOutsideWrapper onClick={state.close} parent={document} includeButtonPress={false}>
            <FocusScope contain autoFocus restoreFocus>
              {/*
                tabIndex=-1 is needed here to support highlighting text within the menu when using FocusScope
                see https://github.com/adobe/react-spectrum/issues/1604#issuecomment-781574668
              */}
              <Menu tabIndex={-1} onClose={state.close} {...menuProps}>
                {options.map((item) => (
                  <MenuItem
                    key={`${item.value}`}
                    label={item.label ?? String(item.value)}
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
