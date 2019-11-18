import React, { PureComponent, SyntheticEvent } from 'react';
import { cx, css } from 'emotion';
import { stylesFactory, withTheme } from '../../themes';
import { GrafanaTheme } from '@grafana/data';
import { Themeable } from '../../types';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    buttonContainer: css`
      width: 24px;
      direction: rtl;
      display: flex;
      align-items: center;
    `,
    button: css`
      position: absolute;
      text-decoration: underline;
      color: ${theme.colors.linkExternal};
    `,
    buttonDisabled: css`
      text-decoration: none;
      color: ${theme.colors.text};
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
      width: 145px;
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
  style?: React.CSSProperties;
  buttonText?: string;
  confirmText?: string;
  disabled?: boolean;

  onConfirm(): void;
  onClick?(): void;
  onCancel?(): void;
}

interface State {
  showConfirm: boolean;
}

class UnThemedConfirmButton extends PureComponent<Props, State> {
  static defaultProps: Partial<Props> = {
    buttonText: 'Edit',
    confirmText: 'Confirm Delete',
    disabled: false,
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
    const { onConfirm, buttonText, disabled, confirmText, className, style, theme } = this.props;
    const styles = getStyles(theme);
    const disabledClass = disabled ? cx('disabled btn-inverse', styles.buttonDisabled) : '';
    const buttonClass = cx(
      styles.button,
      className,
      disabledClass,
      this.state.showConfirm ? styles.buttonHide : styles.buttonShow
    );
    const confirmButtonClass = cx(
      styles.confirmButton,
      this.state.showConfirm ? styles.confirmButtonShow : styles.confirmButtonHide
    );
    const onClick = disabled ? () => {} : this.onClickButton;

    return (
      <span className={cx(styles.buttonContainer)}>
        <a className={buttonClass} style={style} onClick={onClick}>
          {buttonText}
        </a>
        <span className={cx(styles.confirmButtonContainer)}>
          <span className={confirmButtonClass}>
            <a className="btn btn-small" onClick={this.onClickCancel}>
              Cancel
            </a>
            <a className="btn btn-inverse btn-small" onClick={onConfirm}>
              {confirmText}
            </a>
          </span>
        </span>
      </span>
    );
  }
}

export const ConfirmButton = withTheme(UnThemedConfirmButton);
ConfirmButton.displayName = 'ConfirmButton';
