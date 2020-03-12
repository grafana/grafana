import React from 'react';
import { Portal } from '../Portal/Portal';
import { cx } from 'emotion';
import { withTheme } from '../../themes';
import { IconType } from '../Icon/types';
import { Themeable } from '../../types';
import { getModalStyles } from './getModalStyles';
import { ModalHeader } from './ModalHeader';

interface Props extends Themeable {
  icon?: IconType;
  title: string | JSX.Element;
  className?: string;

  isOpen?: boolean;
  onDismiss?: () => void;

  // If not set will call onDismiss if that is set.
  onClickBackdrop?: () => void;
}

export class UnthemedModal extends React.PureComponent<Props> {
  onDismiss = () => {
    if (this.props.onDismiss) {
      this.props.onDismiss();
    }
  };

  onClickBackdrop = () => {
    this.onDismiss();
  };

  renderDefaultHeader(title: string) {
    const { icon } = this.props;

    return <ModalHeader icon={icon} title={title} />;
  }

  render() {
    const { title, isOpen = false, theme, className } = this.props;
    const styles = getModalStyles(theme);

    if (!isOpen) {
      return null;
    }

    return (
      <Portal>
        <div className={cx(styles.modal, className)}>
          <div className={styles.modalHeader}>
            {typeof title === 'string' ? this.renderDefaultHeader(title) : title}
            <a className={styles.modalHeaderClose} onClick={this.onDismiss}>
              <i className="fa fa-remove" />
            </a>
          </div>
          <div className={styles.modalContent}>{this.props.children}</div>
        </div>
        <div className={styles.modalBackdrop} onClick={this.props.onClickBackdrop || this.onClickBackdrop} />
      </Portal>
    );
  }
}

export const Modal = withTheme(UnthemedModal);
