import { css, cx } from '@emotion/css';
import { Placement } from '@popperjs/core';
import { uniqueId } from 'lodash';
import { PureComponent } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { withTheme2 } from '../../../../themes/ThemeContext';
import { Themeable2 } from '../../../../types/theme';
import { Icon } from '../../../Icon/Icon';
import { Tooltip } from '../../../Tooltip/Tooltip';

export interface Props extends Themeable2 {
  label: string;
  checked: boolean;
  disabled?: boolean;
  className?: string;
  labelClass?: string;
  switchClass?: string;
  tooltip?: string;
  tooltipPlacement?: Placement;
  transparent?: boolean;
  onChange: (event: React.SyntheticEvent<HTMLInputElement>) => void;
}

export interface State {
  id: string;
}

/** @deprecated Please use the `Switch` component, {@link https://developers.grafana.com/ui/latest/index.html?path=/story/forms-switch--controlled as seen in Storybook} */
class UnthemedSwitch extends PureComponent<Props, State> {
  state = {
    id: uniqueId(),
  };

  internalOnChange = (event: React.FormEvent<HTMLInputElement>) => {
    event.stopPropagation();
    this.props.onChange(event);
  };

  render() {
    const {
      labelClass = '',
      switchClass = '',
      label,
      checked,
      disabled,
      transparent,
      className,
      theme,
      tooltip,
      tooltipPlacement,
    } = this.props;
    const styles = getStyles(theme);

    const labelId = this.state.id;
    const labelClassName = `gf-form-label ${labelClass} ${transparent ? 'gf-form-label--transparent' : ''} pointer`;
    const switchClassName = cx(styles.switch, switchClass, {
      [styles.switchTransparent]: transparent,
    });

    return (
      <div className={styles.container}>
        <label htmlFor={labelId} className={cx('gf-form', styles.labelContainer, className)}>
          {label && (
            <div className={labelClassName}>
              {label}
              {tooltip && (
                <Tooltip placement={tooltipPlacement ? tooltipPlacement : 'auto'} content={tooltip} theme={'info'}>
                  <Icon name="info-circle" size="sm" style={{ marginLeft: '10px' }} />
                </Tooltip>
              )}
            </div>
          )}
          <div className={switchClassName}>
            <input
              disabled={disabled}
              id={labelId}
              type="checkbox"
              checked={checked}
              onChange={this.internalOnChange}
            />
            <span className={styles.slider} />
          </div>
        </label>
      </div>
    );
  }
}

export const Switch = withTheme2(UnthemedSwitch);

const getStyles = (theme: GrafanaTheme2) => {
  const slider = css({
    background: theme.v1.palette.gray1,
    borderRadius: theme.shape.radius.pill,
    height: '16px',
    width: '32px',
    display: 'block',
    position: 'relative',

    '&::before': {
      position: 'absolute',
      content: "''",
      height: '12px',
      width: '12px',
      left: '2px',
      top: '2px',
      background: theme.components.input.background,
      transition: '0.4s',
      borderRadius: theme.shape.radius.circle,
      boxShadow: theme.shadows.z1,
    },
  });
  return {
    container: css({
      display: 'flex',
      flexShrink: 0,
    }),
    labelContainer: css({
      display: 'flex',
      cursor: 'pointer',
      marginRight: theme.spacing(0.5),
    }),
    switch: css({
      display: 'flex',
      position: 'relative',
      width: '56px',
      height: theme.spacing(4),
      background: theme.components.input.background,
      border: `1px solid ${theme.components.input.borderColor}`,
      borderRadius: theme.shape.radius.default,
      alignItems: 'center',
      justifyContent: 'center',
      input: {
        opacity: 0,
        width: 0,
        height: 0,
      },
      [`input:checked + .${slider}`]: {
        background: theme.colors.primary.main,
      },

      [`input:checked + .${slider}::before`]: {
        transform: 'translateX(16px)',
      },
    }),
    switchTransparent: css({
      background: 'transparent',
      border: 0,
      width: '40px',
    }),
    slider,
  };
};
