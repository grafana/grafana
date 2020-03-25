import React, { PureComponent, SyntheticEvent } from 'react';
import { cx, css } from 'emotion';
import { stylesFactory, withTheme } from '../../themes';
import { GrafanaTheme } from '@grafana/data';
import { Themeable } from '../../types';
import { ComponentSize } from '../../types/size';
import { Button } from '../Button/Button';
import Forms from '../Forms';
import { ButtonVariant } from '../Button/types';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    buttonContainer: css`
      direction: rtl;
      display: flex;
      align-items: center;
    `,
    buttonDisabled: css`
      text-decoration: none;
      color: ${theme.colors.text};
      opacity: 0.65;
      cursor: not-allowed;
      pointer-events: none;
    `,
    buttonShow: css`
      opacity: 1;
      transition: opacity 0.1s ease;
      z-index: 2;
    `,
    buttonHide: css`
      opacity: 0;
      transition: opacity 0.1s ease;
      z-index: 0;
    `,
    confirmButtonContainer: css`
      overflow: hidden;
      position: absolute;
      z-index: 1;
    `,
    confirmButton: css`
      display: flex;
      align-items: flex-start;
    `,
    confirmButtonShow: css`
      opacity: 1;
      transition: opacity 0.08s ease-out, transform 0.1s ease-out;
      transform: translateX(0);
    `,
    confirmButtonHide: css`
      opacity: 0;
      transition: opacity 0.12s ease-in, transform 0.14s ease-in;
      transform: translateX(100px);
    `,
  };
});

interface Props extends Themeable {
  className?: string;
  size?: ComponentSize;
  confirmText?: string;
  disabled?: boolean;
  confirmVariant?: ButtonVariant;

  onConfirm(): void;
  onClick?(): void;
  onCancel?(): void;
}

interface State {
  showConfirm: boolean;
}

class UnThemedConfirmButton extends PureComponent<Props, State> {
  static defaultProps: Partial<Props> = {
    size: 'md',
    confirmText: 'Save',
    disabled: false,
    confirmVariant: 'primary',
  };

  state: State = {
    showConfirm: false,
  };

  onClickButton = (event: SyntheticEvent) => {
    if (event) {
      event.preventDefault();
    }

    this.setState({
      showConfirm: true,
    });

    if (this.props.onClick) {
      this.props.onClick();
    }
  };

  onClickCancel = (event: SyntheticEvent) => {
    if (event) {
      event.preventDefault();
    }
    this.setState({
      showConfirm: false,
    });
    if (this.props.onCancel) {
      this.props.onCancel();
    }
  };

  render() {
    const {
      theme,
      className,
      size,
      disabled,
      confirmText,
      confirmVariant: confirmButtonVariant,
      onConfirm,
      children,
    } = this.props;
    const styles = getStyles(theme);
    const buttonClass = cx(
      className,
      this.state.showConfirm ? styles.buttonHide : styles.buttonShow,
      disabled && styles.buttonDisabled
    );
    const confirmButtonClass = cx(
      styles.confirmButton,
      this.state.showConfirm ? styles.confirmButtonShow : styles.confirmButtonHide
    );
    const onClick = disabled ? () => {} : this.onClickButton;

    return (
      <span className={styles.buttonContainer}>
        {typeof children === 'string' ? (
          <span className={buttonClass}>
            <Forms.Button size={size} variant="link" onClick={onClick}>
              {children}
            </Forms.Button>
          </span>
        ) : (
          <span className={buttonClass} onClick={onClick}>
            {children}
          </span>
        )}
        <span className={styles.confirmButtonContainer}>
          <span className={confirmButtonClass}>
            <Button size={size} variant="transparent" onClick={this.onClickCancel}>
              Cancel
            </Button>
            <Button size={size} variant={confirmButtonVariant} onClick={onConfirm}>
              {confirmText}
            </Button>
          </span>
        </span>
      </span>
    );
  }
}

export const ConfirmButton = withTheme(UnThemedConfirmButton);
ConfirmButton.displayName = 'ConfirmButton';
