import { memo, HTMLAttributes, useState } from 'react';

import { SelectableValue } from '@grafana/data';

import { Menu } from '../Menu/Menu';
import { MenuItem } from '../Menu/MenuItem';
import { ScrollContainer } from '../ScrollContainer/ScrollContainer';
import { ToolbarButton, ToolbarButtonVariant } from '../ToolbarButton/ToolbarButton';
import { PopoverContent } from '../Tooltip/types';

import { Dropdown } from './Dropdown';

export interface Props<T> extends HTMLAttributes<HTMLButtonElement> {
  className?: string;
  options: Array<SelectableValue<T>>;
  value?: SelectableValue<T>;
  onChange: (item: SelectableValue<T>) => void;
  /** @deprecated use tooltip instead, tooltipContent is not being processed in ToolbarButton*/
  tooltipContent?: PopoverContent;
  narrow?: boolean;
  variant?: ToolbarButtonVariant;
  tooltip?: string;
  root?: HTMLElement;
}

/**
 * @deprecated Use Combobox or Dropdown instead
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-deprecated-buttonselect--docs
 */
const ButtonSelectComponent = <T,>(props: Props<T>) => {
  const { className, options, value, onChange, narrow, variant, root, ...restProps } = props;
  const [isOpen, setIsOpen] = useState(false);

  const renderMenu = () => (
    <Menu tabIndex={-1} onClose={() => setIsOpen(false)}>
      <ScrollContainer maxHeight="100vh">
        {options.map((item) => (
          <MenuItem
            key={`${item.value}`}
            label={item.label ?? String(item.value)}
            onClick={() => onChange(item)}
            active={item.value === value?.value}
            ariaChecked={item.value === value?.value}
            ariaLabel={item.ariaLabel || item.label}
            disabled={item.isDisabled}
            component={item.component}
            role="menuitemradio"
          />
        ))}
      </ScrollContainer>
    </Menu>
  );

  return (
    <Dropdown root={root} overlay={renderMenu} placement="bottom-end">
      <ToolbarButton className={className} isOpen={isOpen} narrow={narrow} variant={variant} {...restProps}>
        {value?.label || (value?.value != null ? String(value?.value) : null)}
      </ToolbarButton>
    </Dropdown>
  );
};

ButtonSelectComponent.displayName = 'ButtonSelect';

// needed to properly forward the generic type through React.memo
// see https://github.com/DefinitelyTyped/DefinitelyTyped/issues/37087#issuecomment-656596623
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export const ButtonSelect = memo(ButtonSelectComponent) as typeof ButtonSelectComponent;
