import React, { PureComponent, SyntheticEvent } from 'react';

interface Props {
  onConfirm(): void;
  onClick?(): void;
  onCancel?(): void;
  buttonText: string;
  confirmText?: string;
  disabled?: boolean;
}

interface State {
  showConfirm: boolean;
}

export class ConfirmButton extends PureComponent<Props, State> {
  static defaultProps: Partial<Props> = {
    disabled: false,
    confirmText: 'Confirm Delete',
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
    const { onConfirm, buttonText, disabled, confirmText } = this.props;
    const showConfirmClass = this.state.showConfirm ? 'show' : 'hide';
    const showDeleteButtonClass = this.state.showConfirm ? 'hide' : 'show';
    const disabledClass = disabled ? 'disabled btn-inverse' : '';
    const onClick = disabled ? () => {} : this.onClickButton;

    return (
      <span className="confirm-button-container">
        <a className={`confirm-button btn ${showDeleteButtonClass} ${disabledClass}`} onClick={onClick}>
          {buttonText}
        </a>
        <span className="confirm-delete-container">
          <span className={`confirm-delete ${showConfirmClass}`}>
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
