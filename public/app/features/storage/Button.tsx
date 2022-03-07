import { css } from '@emotion/css';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import {
  ClickOutsideWrapper,
  IconName,
  Menu,
  MenuItem,
  ToolbarButton,
  ToolbarButtonProps,
  useStyles2,
} from '@grafana/ui';
import { FocusScope } from '@react-aria/focus';
import React, { useState } from 'react';

interface Props {
  buttonProps: ToolbarButtonProps;
  options: SelectableValue[];
  onChange: (value: SelectableValue) => void;
}

export function Button({ buttonProps, options, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <ToolbarButton {...buttonProps} onClick={() => setIsOpen(!isOpen)} isOpen={isOpen} />
      {isOpen && (
        <div className={styles.menuWrapper}>
          <ClickOutsideWrapper
            onClick={() => {
              setIsOpen(false);
            }}
            useCapture={true}
            includeButtonPress={false}
          >
            <FocusScope contain autoFocus restoreFocus>
              {/*
              tabIndex=-1 is needed here to support highlighting text within the menu when using FocusScope
              see https://github.com/adobe/react-spectrum/issues/1604#issuecomment-781574668
            */}
              <Menu tabIndex={-1} onClose={() => setIsOpen(false)}>
                {options.map((item) => (
                  <MenuItem
                    key={item.value}
                    icon={item.icon as IconName}
                    label={item.label || item.value}
                    onClick={() => {
                      onChange(item);
                      setIsOpen(false);
                    }}
                    ariaLabel={item.ariaLabel || item.label}
                    role="menuitemradio"
                  />
                ))}
              </Menu>
            </FocusScope>
          </ClickOutsideWrapper>
        </div>
      )}
    </div>
  );
}

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
