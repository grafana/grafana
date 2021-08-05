import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GrafanaTheme2, PanelMenuItem } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { useStyles2 } from '../../themes';
import { PanelMenuListItem } from './PanelMenuItem';
import { Icon } from '../Icon/Icon';
import { ClickOutsideWrapper } from '../ClickOutsideWrapper/ClickOutsideWrapper';

interface Props {
  items: PanelMenuItem[];
  title: string;
  buttonClassName?: string;
  outside?: React.ReactElement;
  inside?: React.ReactElement;
}

const generateMarkup = (item: PanelMenuItem, styles: ReturnType<typeof panelMenuStyles>, items: PanelMenuItem[]) => {
  if (item.type === 'divider') {
    return <li id="divider" role="none" className={styles.divider} key="divider"></li>;
  }

  if (item.subMenu && item.subMenu?.length > 0) {
    return (
      <PanelMenuListItem key={item.text} item={item}>
        <ul className={cx(styles.panelMenu, styles.subMenu)} role="menu" id="panel-menu">
          {item.subMenu.map((i) => generateMarkup(i, styles, items))}
        </ul>
      </PanelMenuListItem>
    );
  } else {
    return <PanelMenuListItem key={item.text} item={item} />;
  }
};

export const PanelMenu = ({ items, title, buttonClassName, outside, inside }: Props) => {
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const onMouseDown = useCallback(() => {
    setIsMouseDown(true);
    setIsDragging(false);
  }, []);

  const onMouseUp = useCallback(() => {
    setIsMouseDown(false);
  }, []);

  const onMouseMove = useCallback(() => {
    if (isMouseDown && !isDragging) {
      setIsDragging(true);
    }
  }, [isMouseDown, isDragging]);

  const [menuIsOpen, setMenuOpen] = useState(false);
  const toggleMenu = useCallback(
    (event: React.SyntheticEvent) => {
      event.preventDefault();
      if (isDragging && !menuIsOpen) {
        return;
      }

      setMenuOpen(!menuIsOpen);
    },
    [menuIsOpen, setMenuOpen, isDragging]
  );

  const handleKeys = (event: React.KeyboardEvent) => {
    const curMenuItem = document.activeElement;
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();

        const prevSibling = (curMenuItem?.parentElement as HTMLLIElement).previousElementSibling;
        let prevMenuItem = prevSibling?.firstElementChild as HTMLButtonElement;
        if (prevSibling && prevSibling.id === 'divider') {
          prevMenuItem = prevSibling.previousElementSibling?.firstElementChild as HTMLButtonElement;
        }

        if (!prevMenuItem) {
          // wrap around to the end if we're at the start of the menu
          const lastMenuItem = curMenuItem?.parentElement?.parentElement?.lastElementChild
            ?.firstElementChild as HTMLButtonElement;
          lastMenuItem.focus();
        } else {
          prevMenuItem.focus();
        }
        break;
      case 'ArrowDown':
        event.preventDefault();

        const nextSibling = (curMenuItem?.parentElement as HTMLLIElement).nextElementSibling;
        let nextMenuItem = nextSibling?.firstElementChild as HTMLButtonElement;

        if (nextSibling && nextSibling.id === 'divider') {
          nextMenuItem = nextSibling.nextElementSibling?.firstElementChild as HTMLButtonElement;
        }
        if (!nextMenuItem) {
          // wrap around to the beginning if we're at the end of the menu
          const firstMenuItem = curMenuItem?.parentElement?.parentElement?.firstElementChild
            ?.firstElementChild as HTMLButtonElement;
          firstMenuItem.focus();
        } else {
          nextMenuItem.focus();
        }
        break;
      case 'ArrowLeft':
        const parentSubmenu = curMenuItem?.parentElement?.parentElement;
        if (parentSubmenu?.id === 'panel-menu') {
          (parentSubmenu.previousElementSibling as HTMLButtonElement).focus();
        }
        break;
      case 'ArrowRight':
        const submenu = curMenuItem?.nextElementSibling;
        if (submenu?.id === 'panel-menu') {
          (submenu.firstChild?.firstChild as HTMLButtonElement).focus();
        }
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        setMenuOpen(false);
        (curMenuItem
          ?.closest('#panel-menu-container')
          ?.querySelector('#panel-menu-button') as HTMLButtonElement).focus();
        break;
      case 'Home':
        event.preventDefault();
        const firstMenuItem = curMenuItem?.parentElement?.parentElement?.firstElementChild
          ?.firstElementChild as HTMLButtonElement;
        firstMenuItem.focus();
        break;
      case 'End':
        event.preventDefault();
        const lastMenuItem = curMenuItem?.parentElement?.parentElement?.lastElementChild
          ?.firstElementChild as HTMLButtonElement;
        lastMenuItem.focus();
        break;
      default:
        break;
    }
  };

  const menuRef = useRef<HTMLUListElement>(null);
  // Set focus to first menu item
  useEffect(() => {
    if (menuIsOpen) {
      ((menuRef.current?.firstElementChild as HTMLLIElement)?.firstElementChild as HTMLButtonElement).focus();
    }
  }, [menuIsOpen]);

  const blurMenu = useCallback(() => {
    setMenuOpen(false);
  }, [setMenuOpen]);

  const styles = useStyles2(panelMenuStyles);

  return (
    <ClickOutsideWrapper includeButtonPress={false} onClick={blurMenu}>
      <div className={styles.container} id="panel-menu-container">
        {outside}
        <button
          id="panel-menu-button"
          className={cx(styles.menuButton, buttonClassName)}
          aria-haspopup="true"
          aria-expanded={menuIsOpen}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onClick={toggleMenu}
        >
          {inside}
          <h2 className={styles.titleText}>{title}</h2>
          <Icon name="angle-down" className={styles.menuToggle} />
        </button>
        <ul
          className={cx(styles.panelMenu, styles.mainMenu)}
          role="menu"
          hidden={!menuIsOpen}
          onKeyDown={handleKeys}
          ref={menuRef}
        >
          {items.map((item) => generateMarkup(item, styles, items))}
        </ul>
      </div>
    </ClickOutsideWrapper>
  );
};

const panelMenuStyles = (theme: GrafanaTheme2) => {
  return {
    titleText: css`
      margin: 0;
      max-width: calc(100% - 38px);
      cursor: pointer;

      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      font-weight: ${theme.typography.fontWeightMedium};
      font-size: ${theme.typography.body.fontSize};

      &:hover {
        color: ${theme.colors.text.primary};
      }
      .panel-has-alert & {
        max-width: calc(100% - 54px);
      }
    `,
    menuButton: css`
      position: relative;
      width: 100%;

      display: flex;
      justify-content: center;
      align-items: center;

      cursor: move;

      border: none;
      background: transparent;
      font-size: 1rem;

      > * {
        cursor: pointer;
      }
    `,
    container: css`
      position: relative;
      height: ${theme.spacing(4)};
      width: 100%;

      display: flex;
      flex-wrap: nowrap;
      justify-content: center;
      align-items: center;

      font-weight: ${theme.typography.fontWeightMedium};
      box-shadow: ${theme.components.panel.boxShadow};

      &:hover,
      :focus-visible,
      :focus-within {
        background-color: ${theme.colors.action.hover};
      }
    `,
    mainMenu: css`
      transform: translateX(-50%);
      min-width: 140px;
      background: ${theme.components.panel.background}
      border: 1px solid ${theme.components.panel.borderColor};
    `,
    divider: css`
      padding: 0px;
      list-style: none;
      height: 1px;
      margin: ${theme.spacing(1)} 0;
      background-color: ${theme.colors.border.weak};
      border-bottom: 1px solid ${theme.colors.border.weak};
    `,

    menuItemPadding: css`
      padding: 5px 10px;
    `,
    menuToggle: css`
      position: absolute;
      top: calc(50% - 9px);
      visibility: hidden;

      margin: 2px 0 0 2px;
      color: ${theme.v1.colors.textWeak};
      opacity: 0;

      &:hover {
        color: ${theme.v1.colors.linkHover};
      }

      #panel-menu-container:hover &,
      #panel-menu-container:focus &,
      #panel-menu-container:focus-within & {
        visibility: visible;
        transition: opacity 0.1s ease-in 0.2s;
        opacity: 1;
      }
    `,
    panelMenu: css`
      position: absolute;
      left: 50%;
      top: 100%;

      display: flex;
      flex-direction: column;

      background-color: ${theme.colors.background.primary};
      border: 1px solid ${theme.components.panel.borderColor};
      border-radius: 3px;
      z-index: 200;
    `,
    subMenu: css`
      border-radius: 0px 6px 6px 6px;
    `,
  };
};
