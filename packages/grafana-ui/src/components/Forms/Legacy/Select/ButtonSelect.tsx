import React, { useState } from 'react';
import { PopoverContent } from '../../../Tooltip/Tooltip';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { ToolbarButton } from '../../../Button';
import { ClickOutsideWrapper } from '../../../ClickOutsideWrapper/ClickOutsideWrapper';
import { css } from 'emotion';
import { useStyles } from '../../../../themes/ThemeContext';
import { Menu, MenuItemsGroup } from '../../../Menu/Menu';

export interface Props<T> {
  className: string | undefined;
  options: Array<SelectableValue<T>>;
  value?: SelectableValue<T>;
  maxMenuHeight?: number;
  onChange: (item: SelectableValue<T>) => void;
  tooltipContent?: PopoverContent;
}

/** @internal */
export const ButtonSelect = React.memo(<T,>(props: Props<T>) => {
  const { className, options, value, onChange } = props;
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
    <div className={styles.wrapper}>
      <ToolbarButton className={className} isOpen={isOpen} onClick={onToggle}>
        {value?.label || value?.value}
      </ToolbarButton>
      {isOpen && (
        <div className={styles.menuWrapper}>
          <ClickOutsideWrapper onClick={onCloseMenu} parent={document}>
            <Menu items={[menuGroup]} />
          </ClickOutsideWrapper>
        </div>
      )}
    </div>
    // <Select
    //   autoFocus={autoFocus}
    //   backspaceRemovesValue={false}
    //   isClearable={false}
    //   isSearchable={false}
    //   options={options}
    //   onChange={this.onChange}
    //   value={value}
    //   isOpen={isMenuOpen}
    //   onOpenMenu={onOpenMenu}
    //   onCloseMenu={onCloseMenu}
    //   maxMenuHeight={maxMenuHeight}
    //   components={combinedComponents}
    //   className="gf-form-select-box-button-select"
    //   tooltipContent={tooltipContent}
    //   tabSelectsValue={tabSelectsValue}
    // />
  );
});

ButtonSelect.displayName = 'ButtonSelect';

const getStyles = (theme: GrafanaTheme) => {
  return {
    wrapper: css`
      position: relative;
      display: flex;
    `,
    menuWrapper: css`
      position: absolute;
      top: ${theme.spacing.formButtonHeight + 2}px;
      right: 0;
    `,
  };
};
