import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Dropdown, Icon, IconButton, Tooltip, useStyles2 } from '@grafana/ui';

interface LogControlOptionProps {
  label?: string;
  expanded: boolean;
  tooltip: string;
  stickToBottom?: boolean;
}

export type Props = React.ComponentProps<typeof IconButton> & LogControlOptionProps;

export const LogListControlsOption = React.forwardRef<HTMLButtonElement, Props>(
  (
    {
      stickToBottom,
      expanded,
      label,
      tooltip,
      className: iconButtonClassName,
      name: iconButtonName,
      ...iconButtonProps
    }: Props,
    ref
  ) => {
    const styles = useStyles2(getStyles, expanded);

    return (
      <div className={`${styles.container} ${stickToBottom ? styles.marginTopAuto : ''}`}>
        <label className={styles.label}>
          <span className={styles.labelText}>{label ?? tooltip}</span>
          <span className={styles.iconContainer}>
            <IconButton
              name={iconButtonName}
              tooltip={tooltip}
              className={iconButtonClassName}
              ref={ref}
              {...iconButtonProps}
            />
          </span>
        </label>
      </div>
    );
  }
);

interface LogControlSelectOptionProps {
  label?: string;
  expanded: boolean;
  tooltip: string;
  stickToBottom?: boolean;
  dropdown: JSX.Element;
  isActive: boolean;
  customTagText: string;
  buttonAriaLabel: string;
}
export type SelectProps = React.ComponentProps<typeof Icon> & LogControlSelectOptionProps;

export const LogListControlsSelectOption = React.forwardRef<SVGElement, SelectProps>(
  (
    {
      stickToBottom,
      expanded,
      label,
      tooltip,
      className: iconButtonClassName,
      name: iconButtonName,
      dropdown,
      isActive: isActive,
      customTagText,
      buttonAriaLabel,
      ...iconButtonProps
    }: SelectProps,
    ref
  ) => {
    const styles = useStyles2(getStyles, expanded);

    return (
      <div className={styles.container}>
        <label className={styles.label}>
          <span className={styles.labelText}>{label ?? tooltip}</span>
          <span>
            <Dropdown overlay={dropdown} placement="auto-end">
              <div className={styles.iconContainer}>
                <Tooltip content={tooltip}>
                  <button
                    aria-pressed={isActive}
                    aria-label={buttonAriaLabel}
                    className={`${styles.customControlButton} ${isActive ? styles.controlButtonActive : styles.controlButton}`}
                    type="button"
                  >
                    <Icon
                      ref={ref}
                      {...iconButtonProps}
                      name={iconButtonName}
                      size="lg"
                      className={styles.customControlIcon}
                    />
                    {isActive && <span className={styles.customControlTag}>{customTagText}</span>}
                  </button>
                </Tooltip>
              </div>
            </Dropdown>
          </span>
        </label>
      </div>
    );
  }
);

LogListControlsSelectOption.displayName = 'LogListControlsSelectOption';
const getStyles = (theme: GrafanaTheme2, expanded: boolean) => {
  return {
    customControlTag: css({
      color: theme.colors.primary.text,
      fontSize: 10,
      position: 'absolute',
      bottom: -4,
      right: 1,
      lineHeight: '10px',
      backgroundColor: theme.colors.background.primary,
      paddingLeft: 2,
    }),
    customControlIcon: css({
      verticalAlign: 'baseline',
    }),
    customControlButton: css({
      position: 'relative',
      zIndex: 0,
      margin: 0,
      boxShadow: 'none',
      border: 'none',
      display: 'flex',
      background: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 0,
      overflow: 'visible',
      width: '100%',
    }),
    controlButtonActive: css({
      margin: 0,
      color: theme.colors.text.secondary,
      height: theme.spacing(2),
      '&:after': {
        display: 'block',
        content: '" "',
        position: 'absolute',
        height: 2,
        borderRadius: theme.shape.radius.default,
        bottom: theme.spacing(-1),
        backgroundImage: theme.colors.gradients.brandHorizontal,
        width: theme.spacing(2.25),
        opacity: 1,
      },
    }),
    controlButton: css({
      margin: 0,
      color: theme.colors.text.secondary,
      height: theme.spacing(2),
    }),
    marginTopAuto: css({
      marginTop: 'auto',
    }),
    labelText: css({
      display: expanded ? 'block' : 'none',
    }),
    iconContainer: css({
      display: 'flex',
      alignItems: 'center',
      height: '16px',
    }),
    container: css({
      fontSize: theme.typography.pxToRem(12),
      height: theme.spacing(2),
      width: 'auto',
    }),
    label: css({
      display: 'flex',
      justifyContent: expanded ? 'space-between' : 'center',
      marginRight: expanded ? '2.5px' : 0,
    }),
  };
};

LogListControlsOption.displayName = 'LogListControlsOption';
