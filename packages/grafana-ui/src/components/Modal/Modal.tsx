import React from 'react';
import { Portal } from '../Portal/Portal';
import { css, cx } from 'emotion';
import { stylesFactory, withTheme } from '../../themes';
import { GrafanaTheme } from '@grafana/data';

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  modal: css`
    position: fixed;
    z-index: ${theme.zIndex.modal};
    background: ${theme.colors.pageBg};
    box-shadow: 0 3px 7px rgba(0, 0, 0, 0.3);
    background-clip: padding-box;
    outline: none;
    width: 750px;
    max-width: 100%;
    left: 0;
    right: 0;
    margin-left: auto;
    margin-right: auto;
    top: 10%;
  `,
  modalBackdrop: css`
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: ${theme.zIndex.modalBackdrop};
    background-color: ${theme.colors.blueFaint};
    opacity: 0.8;
    backdrop-filter: blur(4px);
  `,
  modalHeader: css`
    background: ${theme.background.pageHeader};
    box-shadow: ${theme.shadow.pageHeader};
    border-bottom: 1px solid ${theme.colors.pageHeaderBorder};
    display: flex;
  `,
  modalHeaderTitle: css`
    font-size: ${theme.typography.heading.h3};
    padding-top: ${theme.spacing.sm};
    margin: 0 ${theme.spacing.md};
  `,
  modalHeaderIcon: css`
    position: relative;
    top: 2px;
    padding-right: ${theme.spacing.md};
  `,
  modalHeaderClose: css`
    margin-left: auto;
    padding: 9px ${theme.spacing.d};
  `,
  modalContent: css`
    padding: calc(${theme.spacing.d} * 2);
    overflow: auto;
    width: 100%;
    max-height: calc(90vh - ${theme.spacing.d} * 2);
  `,
}));

interface Props {
  icon?: string;
  title: string | JSX.Element;
  theme: GrafanaTheme;

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

  renderDefaultHeader() {
    const { title, icon, theme } = this.props;
    const styles = getStyles(theme);

    return (
      <h2 className={styles.modalHeaderTitle}>
        {icon && <i className={cx(icon, styles.modalHeaderIcon)} />}
        {title}
      </h2>
    );
  }

  render() {
    const { title, isOpen = false, theme } = this.props;
    const styles = getStyles(theme);

    if (!isOpen) {
      return null;
    }

    return (
      <Portal>
        <div className={styles.modal}>
          <div className={styles.modalHeader}>
            {typeof title === 'string' ? this.renderDefaultHeader() : title}
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
