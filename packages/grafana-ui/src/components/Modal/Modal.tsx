import { cx } from '@emotion/css';
import { FloatingFocusManager, useDismiss, useFloating, useInteractions, useRole } from '@floating-ui/react';
import { OverlayContainer } from '@react-aria/overlays';
import { PropsWithChildren, ReactNode, useId, type JSX } from 'react';

import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { IconName } from '../../types/icon';
import { IconButton } from '../IconButton/IconButton';
import { Stack } from '../Layout/Stack/Stack';

import { ModalHeader } from './ModalHeader';
import { getModalStyles } from './getModalStyles';

interface BaseProps {
  /** @deprecated no longer used */
  icon?: IconName;
  /** @deprecated no longer used */
  iconTooltip?: string;
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

  const { context, refs } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      if (!open) {
        onDismiss?.();
      }
    },
  });

  const dismiss = useDismiss(context, {
    enabled: closeOnEscape,
  });

  const role = useRole(context, {
    role: 'dialog',
  });

  const { getFloatingProps } = useInteractions([dismiss, role]);

  if (!isOpen) {
    return null;
  }

  const headerClass = cx(styles.modalHeader, typeof title !== 'string' && styles.modalHeaderWithTabs);

  return (
    <OverlayContainer>
      <div
        role="presentation"
        className={styles.modalBackdrop}
        onClick={onClickBackdrop || (closeOnBackdropClick ? onDismiss : undefined)}
      />
      <FloatingFocusManager context={context} modal={trapFocus}>
        <div
          className={cx(styles.modal, className)}
          ref={refs.setFloating}
          aria-label={ariaLabel}
          aria-labelledby={typeof title === 'string' ? titleId : undefined}
          {...getFloatingProps()}
        >
          <div className={headerClass}>
            {typeof title === 'string' && <DefaultModalHeader {...props} title={title} id={titleId} />}
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
        </div>
      </FloatingFocusManager>
    </OverlayContainer>
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

interface DefaultModalHeaderProps {
  id?: string;
  title: string;
  icon?: IconName;
  iconTooltip?: string;
}

function DefaultModalHeader({ icon, iconTooltip, title, id }: DefaultModalHeaderProps): JSX.Element {
  return <ModalHeader icon={icon} iconTooltip={iconTooltip} title={title} id={id} />;
}
