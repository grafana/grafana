import { cx } from '@emotion/css';
import { type PropsWithChildren, type ReactNode, useId, type JSX } from 'react';

import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { IconButton } from '../IconButton/IconButton';
import { Stack } from '../Layout/Stack/Stack';

import { ModalBase } from './ModalBase';
import { ModalHeader } from './ModalHeader';
import { getModalStyles } from './getModalStyles';

interface BaseProps {
  className?: string;
  contentClassName?: string;
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
  trapFocus?: boolean;

  isOpen?: boolean;
  onDismiss?: () => void;

  /** If not set will call onDismiss if that is set. */
  onClickBackdrop?: () => void;
}

interface WithStringTitleProps extends BaseProps {
  /** Title for the modal or custom header element */
  title: string;
  ariaLabel?: never;
}

interface WithCustomTitleProps extends BaseProps {
  /** Title for the modal or custom header element */
  title: JSX.Element;
  /** aria-label for the dialog. only needed when passing a custom title element */
  ariaLabel: string;
}

export type Props = WithStringTitleProps | WithCustomTitleProps;

/**
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/overlays-modal--docs
 */
export function Modal(props: PropsWithChildren<Props>) {
  const {
    title,
    ariaLabel,
    children,
    isOpen = false,
    closeOnEscape = true,
    closeOnBackdropClick = true,
    className,
    contentClassName,
    onDismiss,
    onClickBackdrop,
    trapFocus = true,
  } = props;
  const styles = useStyles2(getModalStyles);
  const titleId = useId();

  const headerClass = cx(styles.modalHeader, typeof title !== 'string' && styles.modalHeaderWithTabs);

  return (
    <ModalBase
      isOpen={isOpen}
      onDismiss={onDismiss}
      closeOnEscape={closeOnEscape}
      closeOnBackdropClick={closeOnBackdropClick}
      trapFocus={trapFocus}
      className={className}
      onClickBackdrop={onClickBackdrop}
      aria-label={ariaLabel}
      aria-labelledby={typeof title === 'string' ? titleId : undefined}
    >
      <div className={headerClass}>
        {typeof title === 'string' && <ModalHeader title={title} id={titleId} />}
        {
          // FIXME: custom title components won't get an accessible title.
          // Do we really want to support them or shall we just limit this ModalTabsHeader?
          typeof title !== 'string' && title
        }
        <div className={styles.modalHeaderClose}>
          <IconButton
            name="times"
            size="xl"
            onClick={onDismiss}
            aria-label={t('grafana-ui.modal.close-tooltip', 'Close')}
          />
        </div>
      </div>
      <div className={cx(styles.modalContent, contentClassName)}>{children}</div>
    </ModalBase>
  );
}

function ModalButtonRow({ leftItems, children }: { leftItems?: ReactNode; children: ReactNode }) {
  const styles = useStyles2(getModalStyles);

  if (leftItems) {
    return (
      <div className={styles.modalButtonRow}>
        <Stack justifyContent="space-between">
          <Stack justifyContent="flex-start" gap={2}>
            {leftItems}
          </Stack>
          <Stack justifyContent="flex-end" gap={2}>
            {children}
          </Stack>
        </Stack>
      </div>
    );
  }

  return (
    <div className={styles.modalButtonRow}>
      <Stack justifyContent="flex-end" gap={2} wrap="wrap">
        {children}
      </Stack>
    </div>
  );
}

Modal.ButtonRow = ModalButtonRow;
