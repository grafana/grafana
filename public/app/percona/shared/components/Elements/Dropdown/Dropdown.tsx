/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { cx } from '@emotion/css';
import { Options as PopperOptions } from '@popperjs/core';
import React, { FC, memo, useEffect, useRef, useState } from 'react';
import { usePopper } from 'react-popper';

import { useStyles2 } from '@grafana/ui';

import { getStyles } from './Dropdown.styles';

const popperConfig: Partial<PopperOptions> = {
  placement: 'bottom',
  modifiers: [
    {
      name: 'offset',
      enabled: true,
      options: {
        offset: [0, 2],
      },
    },
    {
      name: 'preventOverflow',
      options: {
        altAxis: true,
        padding: 12,
      },
    },
  ],
};

export interface DropdownProps {
  // TODO: improve this
  toggle: React.ForwardRefExoticComponent<React.RefAttributes<any> & React.HTMLAttributes<any>>;
  children: React.ReactElement[] | React.ReactElement;
  className?: string;
}

export const Dropdown: FC<DropdownProps> = memo(function Dropdown({ className, children, toggle: Toggle }) {
  const styles = useStyles2(getStyles);

  const [visible, setVisible] = useState(false);
  const size = React.Children.count(children);

  const toggleRef = useRef<HTMLDivElement>(null);
  const popperRef = useRef<HTMLDivElement>(null);
  // NOTE: -1 is used to indicate that there are no active menu items
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  // TODO: find a way to improve this
  const childrenArray = size > 1 ? children : (React.Children.toArray(children) as any);

  const menuItems = React.Children.map(childrenArray, (child, index) =>
    React.cloneElement(child, {
      ...child.props,
      onClick: () => {
        setActiveIndex(index);
        child.props.onClick();
      },
      className: cx(child.props.className, { active: index === activeIndex }),
    })
  );

  const {
    styles: popperStyles,
    attributes: popperAttributes,
    update: updatePopper,
  } = usePopper(toggleRef.current, popperRef.current, popperConfig);

  const handleDocumentClick = (event: MouseEvent) => {
    if (toggleRef.current?.contains(event.target as Node) || popperRef.current?.contains(event.target as Node)) {
      return;
    }

    setVisible(false);
  };

  const handleDropdownClick = async () => {
    setVisible((oldValue) => !oldValue);

    if (updatePopper != null) {
      await updatePopper();
    }
  };

  useEffect(() => {
    const up = ['ArrowUp', 'ArrowLeft'];
    const down = ['ArrowDown', 'ArrowRight'];
    const handleKeyupClick = (event: KeyboardEvent) => {
      if (!visible) {
        return;
      }

      const { code } = event;

      if (up.includes(code)) {
        setActiveIndex((currentIndex) => (currentIndex === 0 ? size - 1 : currentIndex - 1));
        event.preventDefault();
      }

      if (down.includes(code)) {
        setActiveIndex((currentIndex) => (currentIndex === size - 1 ? 0 : currentIndex + 1));
        event.preventDefault();
      }

      if (code === 'Escape') {
        setVisible(false);
      }

      if (code === 'Enter' && activeIndex !== -1) {
        const menuItem: any = React.Children.toArray(children).find((_, index) => index === activeIndex);

        if (menuItem) {
          menuItem.props.onClick();
          setVisible(false);
        }
      }
    };
    const handleKeydownClick = (event: KeyboardEvent) => {
      if (visible) {
        event.preventDefault();
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('keyup', handleKeyupClick);
    document.addEventListener('keydown', handleKeydownClick);

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keyup', handleKeyupClick);
      document.removeEventListener('keydown', handleKeydownClick);

      // on close reset index
      if (!visible) {
        setActiveIndex(-1);
      }
    };
  }, [activeIndex, children, size, visible]);

  return (
    <>
      <div ref={toggleRef}>
        <Toggle onClick={handleDropdownClick} data-testid="dropdown-menu-toggle" />
      </div>

      <div
        ref={popperRef}
        style={popperStyles.popper}
        className={styles.dropdown}
        {...popperAttributes.popper}
        data-testid="dropdown-menu-container"
      >
        {visible ? (
          <div
            className={cx(styles.dropdownMenu, className)}
            style={popperStyles.offset}
            data-testid="dropdown-menu-menu"
            onClick={handleDropdownClick}
          >
            {menuItems}
          </div>
        ) : null}
      </div>
    </>
  );
});
