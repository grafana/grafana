import { css } from '@emotion/css';
import React, { type JSX, useId } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
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
      onClick,
      id,
      ...iconButtonProps
    }: Props,
    ref
  ) => {
    const styles = useStyles2(getStyles, expanded);
    const autoId = useId();
    const controlButtonId = id ?? autoId;

    return (
      <div className={`${styles.container} ${stickToBottom ? styles.marginTopAuto : ''}`}>
        <div className={styles.label}>
          <label className={styles.labelCaption} htmlFor={controlButtonId}>
            <span className={styles.labelText}>{label ?? tooltip}</span>
          </label>
          <span className={styles.iconContainer}>
            <IconButton
              id={controlButtonId}
              name={iconButtonName}
              tooltip={tooltip}
              className={iconButtonClassName}
              ref={ref}
              {...iconButtonProps}
              onClick={onClick}
            />
          </span>
        </div>
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
      isActive,
      customTagText,
      buttonAriaLabel,
      ...iconButtonProps
    }: SelectProps,
    ref
  ) => {
    const styles = useStyles2(getStyles, expanded);
    const controlButtonId = useId();

    return (
      <div className={styles.container}>
        <div className={styles.label}>
          <label className={styles.labelCaption} htmlFor={controlButtonId}>
            <span className={styles.labelText}>{label ?? tooltip}</span>
          </label>
          <span>
            <Dropdown overlay={dropdown} placement="auto-end">
              <div className={styles.iconContainer}>
                <Tooltip content={tooltip}>
                  <button
                    id={controlButtonId}
                    aria-pressed={isActive}
                    aria-label={buttonAriaLabel}
                    className={`${styles.customControlButton} ${isActive ? styles.controlButtonActive : styles.controlButton}`}
                    type="button"
                  >
                    <Icon
                      {...iconButtonProps}
                      ref={ref}
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
        </div>
      </div>
    );
  }
);

LogListControlsSelectOption.displayName = 'LogListControlsSelectOption';
const getStyles = (theme: GrafanaTheme2, expanded: boolean) => {
  const hoverSize = '26';
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
      '&:hover': {
        '&:before': {
          backgroundColor: theme.colors.action.hover,
          opacity: 1,
        },
      },
      '&:before': {
        zIndex: -1,
        position: 'absolute',
        opacity: 0,
        width: `${hoverSize}px`,
        height: `${hoverSize}px`,
        borderRadius: theme.shape.radius.default,
        content: '""',
        [theme.transitions.handleMotion('no-preference', 'reduce')]: {
          transitionDuration: '0.2s',
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
          transitionProperty: 'opacity',
        },
      },
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
      marginBottom: theme.spacing(1),
    }),
    labelText: css({
      display: expanded ? 'block' : 'none',
    }),
    labelCaption: css({
      cursor: 'pointer',
      flex: expanded ? 1 : undefined,
      minWidth: 0,
      margin: 0,
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
