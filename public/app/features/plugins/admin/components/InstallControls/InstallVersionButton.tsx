import React, { ReactElement, useState } from 'react';
import { css } from '@emotion/css';
import { Badge, Button, ButtonGroup, ClickOutsideWrapper, Menu, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { PropsWithChildren } from 'react-router/node_modules/@types/react';
import { Version } from '../../types';

type Props = {
  disabled?: boolean;
  version: Version;
  versions: Version[];
  onInstall: (version: Version) => void;
  onChange: (version: Version) => void;
};

export function InstallVersionButton(props: PropsWithChildren<Props>): ReactElement {
  const { version, versions, onInstall, onChange, children, disabled } = props;
  const styles = useStyles2(getStyles);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={styles.container}>
      <ButtonGroup>
        <Button disabled={disabled} onClick={() => onInstall(version)}>
          {children}
        </Button>
        <Button
          disabled={disabled}
          icon={isOpen ? 'angle-up' : 'angle-down'}
          onClick={(event) => {
            setIsOpen(!isOpen);
            event.stopPropagation();
          }}
        />
      </ButtonGroup>
      {isOpen && (
        <div className={styles.menu}>
          <ClickOutsideWrapper onClick={() => setIsOpen(false)}>
            <Menu>
              {versions.map((v, i) => (
                <div
                  key={v.version}
                  className={styles.menuItem}
                  onClick={() => {
                    onChange(v);
                    setIsOpen(false);
                  }}
                >
                  <span>v{v.version}</span>{' '}
                  {i === 0 && (
                    <div className={styles.badge}>
                      <Badge text="Latest" color="blue" />
                    </div>
                  )}
                </div>
              ))}
            </Menu>
          </ClickOutsideWrapper>
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      position: relative;
    `,
    menu: css`
      position: absolute;
      z-index: ${theme.zIndex.dropdown};
      top: ${theme.spacing(4)};
      right: 0;
    `,
    menuItem: css`
      background: none;
      cursor: pointer;
      white-space: nowrap;
      color: ${theme.colors.text.primary};
      display: flex;
      padding: 5px 12px 5px 10px;
      margin: 0;
      border: none;
      width: 100%;

      &:hover,
      &:focus,
      &:focus-visible {
        background: ${theme.colors.action.hover};
        color: ${theme.colors.text.primary};
        text-decoration: none;
      }
    `,
    activeItem: css`
      background: ${theme.colors.action.selected};
    `,
    badge: css`
      margin-left: ${theme.spacing(2)};
    `,
  };
};
