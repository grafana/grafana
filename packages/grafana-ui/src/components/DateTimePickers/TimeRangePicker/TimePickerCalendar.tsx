import { css } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { FocusScope } from '@react-aria/focus';
import { OverlayContainer, useOverlay } from '@react-aria/overlays';
import React, { FormEvent, memo } from 'react';

import { DateTime, GrafanaTheme2, TimeZone } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useTheme2 } from '../../../themes';
import { getModalStyles } from '../../Modal/getModalStyles';

import { Body } from './CalendarBody';
import { Footer } from './CalendarFooter';
import { Header } from './CalendarHeader';

export const getStyles = (theme: GrafanaTheme2, isReversed = false) => {
  return {
    container: css`
      top: 0px;
      position: absolute;
      ${isReversed ? 'left' : 'right'}: 544px;
      box-shadow: ${theme.shadows.z3};
      background-color: ${theme.colors.background.primary};
      z-index: -1;
      border: 1px solid ${theme.colors.border.weak};
      border-radius: 2px 0 0 2px;

      &:after {
        display: block;
        background-color: ${theme.colors.background.primary};
        width: 19px;
        height: 100%;
        content: ${!isReversed ? ' ' : ''};
        position: absolute;
        top: 0;
        right: -19px;
        border-left: 1px solid ${theme.colors.border.weak};
      }
    `,
    modal: css`
      box-shadow: ${theme.shadows.z3};
      left: 50%;
      position: fixed;
      top: 50%;
      transform: translate(-50%, -50%);
      z-index: ${theme.zIndex.modal};
    `,
    content: css`
      margin: 0 auto;
      width: 268px;
    `,
  };
};

export interface TimePickerCalendarProps {
  isOpen: boolean;
  from: DateTime;
  to: DateTime;
  onClose: () => void;
  onApply: (e: FormEvent<HTMLButtonElement>) => void;
  onChange: (from: DateTime, to: DateTime) => void;
  isFullscreen: boolean;
  timeZone?: TimeZone;
  isReversed?: boolean;
}

const stopPropagation = (event: React.MouseEvent<HTMLDivElement>) => event.stopPropagation();

function TimePickerCalendar(props: TimePickerCalendarProps) {
  const theme = useTheme2();
  const { modalBackdrop } = getModalStyles(theme);
  const styles = getStyles(theme, props.isReversed);
  const { isOpen, isFullscreen, onClose } = props;
  const ref = React.createRef<HTMLElement>();
  const { dialogProps } = useDialog(
    {
      'aria-label': selectors.components.TimePicker.calendar.label,
    },
    ref
  );
  const { overlayProps } = useOverlay(
    {
      isDismissable: true,
      isOpen,
      onClose,
    },
    ref
  );

  if (!isOpen) {
    return null;
  }

  if (isFullscreen) {
    return (
      <FocusScope contain restoreFocus autoFocus>
        <section className={styles.container} onClick={stopPropagation} ref={ref} {...overlayProps} {...dialogProps}>
          <Header {...props} />
          <Body {...props} />
        </section>
      </FocusScope>
    );
  }

  return (
    <OverlayContainer>
      <div className={modalBackdrop} onClick={stopPropagation} />
      <FocusScope contain autoFocus restoreFocus>
        <section className={styles.modal} onClick={stopPropagation} ref={ref} {...overlayProps} {...dialogProps}>
          <div className={styles.content} aria-label={selectors.components.TimePicker.calendar.label}>
            <Header {...props} />
            <Body {...props} />
            <Footer {...props} />
          </div>
        </section>
      </FocusScope>
    </OverlayContainer>
  );
}
export default memo(TimePickerCalendar);
TimePickerCalendar.displayName = 'TimePickerCalendar';
