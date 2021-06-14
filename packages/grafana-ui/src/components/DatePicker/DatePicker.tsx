import React, { memo } from 'react';
import Calendar from 'react-calendar';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '../../themes';
import { ClickOutsideWrapper } from '../ClickOutsideWrapper/ClickOutsideWrapper';
import { Icon } from '../Icon/Icon';

export interface DatePickerProps {
  isOpen?: boolean;
  onClose: () => void;
  onChange: (value: Date) => void;
  value?: Date;
}

export const DatePicker = memo<DatePickerProps>((props) => {
  const styles = useStyles(getStyles);
  const { isOpen, onClose } = props;

  if (!isOpen) {
    return null;
  }

  return (
    <ClickOutsideWrapper useCapture={true} includeButtonPress={false} onClick={onClose}>
      <div className={styles.modal} data-testid="date-picker">
        <Body {...props} />
      </div>
    </ClickOutsideWrapper>
  );
});

DatePicker.displayName = 'DatePicker';

const Body = memo<DatePickerProps>(({ value, onChange }) => {
  const styles = useStyles(getBodyStyles);

  return (
    <Calendar
      className={styles.body}
      tileClassName={styles.title}
      value={value || new Date()}
      nextLabel={<Icon name="angle-right" />}
      prevLabel={<Icon name="angle-left" />}
      onChange={(ev) => {
        if (!Array.isArray(ev)) {
          onChange(ev);
        }
      }}
      locale="en"
    />
  );
});

Body.displayName = 'Body';

export const getStyles = (theme: GrafanaTheme) => {
  const containerBorder = theme.isDark ? theme.palette.dark9 : theme.palette.gray5;

  return {
    container: css`
      top: -1px;
      position: absolute;
      right: 544px;
      box-shadow: 0px 0px 20px ${theme.colors.dropdownShadow};
      background-color: ${theme.colors.bodyBg};
      z-index: -1;
      border: 1px solid ${containerBorder};
      border-radius: 2px 0 0 2px;

      &:after {
        display: block;
        background-color: ${theme.colors.bodyBg};
        width: 19px;
        height: 100%;
        content: '';
        position: absolute;
        top: 0;
        right: -19px;
        border-left: 1px solid ${theme.colors.border1};
      }
    `,
    modal: css`
      z-index: ${theme.zIndex.modal};
    `,
    content: css`
      margin: 0 auto;
      width: 268px;
    `,
    backdrop: css`
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      background: #202226;
      opacity: 0.7;
      z-index: ${theme.zIndex.modalBackdrop};
      text-align: center;
    `,
  };
};

export const getBodyStyles = (theme: GrafanaTheme) => {
  const containerBorder = theme.isDark ? theme.palette.dark9 : theme.palette.gray5;

  return {
    title: css`
      color: ${theme.colors.text};
      background-color: ${theme.colors.bodyBg};
      font-size: ${theme.typography.size.md};
      border: 1px solid transparent;

      &:hover {
        position: relative;
      }
    `,
    body: css`
      z-index: ${theme.zIndex.modal};
      position: fixed;
      background-color: ${theme.colors.bodyBg};
      width: 268px;

      box-shadow: 0px 0px 20px ${theme.colors.dropdownShadow};
      border: 1px solid ${containerBorder};
      border-radius: 2px 0 0 2px;

      .react-calendar__navigation__label,
      .react-calendar__navigation__arrow,
      .react-calendar__navigation {
        padding-top: 4px;
        background-color: inherit;
        color: ${theme.colors.text};
        border: 0;
        font-weight: ${theme.typography.weight.semibold};
      }

      .react-calendar__month-view__weekdays {
        background-color: inherit;
        text-align: center;
        color: ${theme.palette.blue77};

        abbr {
          border: 0;
          text-decoration: none;
          cursor: default;
          display: block;
          padding: 4px 0 4px 0;
        }
      }

      .react-calendar__month-view__days {
        background-color: inherit;
      }

      .react-calendar__tile,
      .react-calendar__tile--now {
        margin-bottom: 4px;
        background-color: inherit;
        height: 26px;
      }

      .react-calendar__navigation__label,
      .react-calendar__navigation > button:focus,
      .time-picker-calendar-tile:focus {
        outline: 0;
      }

      .react-calendar__tile--active,
      .react-calendar__tile--active:hover {
        color: ${theme.palette.white};
        font-weight: ${theme.typography.weight.semibold};
        background: ${theme.palette.blue95};
        box-shadow: none;
        border: 0px;
      }

      .react-calendar__tile--rangeEnd,
      .react-calendar__tile--rangeStart {
        padding: 0;
        border: 0px;
        color: ${theme.palette.white};
        font-weight: ${theme.typography.weight.semibold};
        background: ${theme.palette.blue95};

        abbr {
          background-color: ${theme.palette.blue77};
          border-radius: 100px;
          display: block;
          padding-top: 2px;
          height: 26px;
        }
      }

      .react-calendar__tile--rangeStart {
        border-top-left-radius: 20px;
        border-bottom-left-radius: 20px;
      }

      .react-calendar__tile--rangeEnd {
        border-top-right-radius: 20px;
        border-bottom-right-radius: 20px;
      }
    `,
  };
};
