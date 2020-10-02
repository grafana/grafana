import { GrafanaTheme, isDateTime, TimeOption, TimeRange, TimeZone } from '@grafana/data';
import { css, cx } from 'emotion';
import React, { memo, useState } from 'react';
import { useMedia } from 'react-use';
import { stylesFactory, useTheme } from '../../../themes';
import { CustomScrollbar } from '../../CustomScrollbar/CustomScrollbar';
import { Icon } from '../../Icon/Icon';
import { mapRangeToTimeOption } from './mapper';
import { TimePickerTitle } from './TimePickerTitle';
import { TimeRangeForm } from './TimeRangeForm';
import { TimeRangeList } from './TimeRangeList';
import { TimePickerFooter } from './TimePickerFooter';

const getStyles = stylesFactory((theme: GrafanaTheme, isReversed) => {
  const containerBorder = theme.isDark ? theme.palette.dark9 : theme.palette.gray5;

  return {
    container: css`
      background: ${theme.colors.bodyBg};
      box-shadow: 0px 0px 20px ${theme.colors.dropdownShadow};
      position: absolute;
      z-index: ${theme.zIndex.modal};
      width: 546px;
      top: 116%;
      border-radius: 2px;
      border: 1px solid ${containerBorder};
      right: ${isReversed ? 'unset' : 0};

      @media only screen and (max-width: ${theme.breakpoints.lg}) {
        width: 262px;
      }
    `,
    body: css`
      display: flex;
      height: 381px;
    `,
    leftSide: css`
      display: flex;
      flex-direction: column;
      border-right: ${isReversed ? 'none' : `1px solid ${theme.colors.border1}`};
      width: 60%;
      overflow: hidden;
      order: ${isReversed ? 1 : 0};

      @media only screen and (max-width: ${theme.breakpoints.lg}) {
        display: none;
      }
    `,
    rightSide: css`
      width: 40% !important;
      border-right: ${isReversed ? `1px solid ${theme.colors.border1}` : 'none'};

      @media only screen and (max-width: ${theme.breakpoints.lg}) {
        width: 100% !important;
      }
    `,
    spacing: css`
      margin-top: 16px;
    `,
  };
});

const getNarrowScreenStyles = stylesFactory((theme: GrafanaTheme) => {
  const formBackground = theme.isDark ? theme.palette.gray15 : theme.palette.gray98;

  return {
    header: css`
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid ${theme.colors.border1};
      padding: 7px 9px 7px 9px;
    `,
    body: css`
      border-bottom: 1px solid ${theme.colors.border1};
      background: ${formBackground};
      box-shadow: inset 0px 2px 2px ${theme.colors.dropdownShadow};
    `,
    form: css`
      padding: 7px 9px 7px 9px;
    `,
  };
});

const getFullScreenStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      padding-top: 9px;
      padding-left: 11px;
      padding-right: 20%;
    `,
    title: css`
      margin-bottom: 11px;
    `,
    recent: css`
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
    `,
  };
});

const getEmptyListStyles = stylesFactory((theme: GrafanaTheme) => {
  const formBackground = theme.isDark ? theme.palette.gray15 : theme.palette.gray98;

  return {
    container: css`
      background-color: ${formBackground};
      padding: 12px;
      margin: 12px;

      a,
      span {
        font-size: 13px;
      }
    `,
    link: css`
      color: ${theme.colors.linkExternal};
    `,
  };
});

interface Props {
  value: TimeRange;
  onChange: (timeRange: TimeRange) => void;
  onChangeTimeZone: (timeZone: TimeZone) => void;
  timeZone?: TimeZone;
  quickOptions?: TimeOption[];
  otherOptions?: TimeOption[];
  history?: TimeRange[];
  showHistory?: boolean;
  className?: string;
  hideTimeZone?: boolean;
  /** Reverse the order of relative and absolute range pickers. Used to left align the picker in forms */
  isReversed?: boolean;
}

interface PropsWithScreenSize extends Props {
  isFullscreen: boolean;
}

interface FormProps extends Omit<Props, 'history'> {
  visible: boolean;
  historyOptions?: TimeOption[];
}

export const TimePickerContentWithScreenSize: React.FC<PropsWithScreenSize> = props => {
  const theme = useTheme();
  const styles = getStyles(theme, props.isReversed);
  const historyOptions = mapToHistoryOptions(props.history, props.timeZone);
  const { quickOptions = [], otherOptions = [], isFullscreen } = props;

  return (
    <div className={cx(styles.container, props.className)}>
      <div className={styles.body}>
        <div className={styles.leftSide}>
          <FullScreenForm {...props} visible={isFullscreen} historyOptions={historyOptions} />
        </div>
        <CustomScrollbar className={styles.rightSide}>
          <NarrowScreenForm {...props} visible={!isFullscreen} historyOptions={historyOptions} />
          <TimeRangeList
            title="Relative time ranges"
            options={quickOptions}
            onSelect={props.onChange}
            value={props.value}
            timeZone={props.timeZone}
          />
          <div className={styles.spacing} />
          <TimeRangeList
            title="Other quick ranges"
            options={otherOptions}
            onSelect={props.onChange}
            value={props.value}
            timeZone={props.timeZone}
          />
        </CustomScrollbar>
      </div>
      {!props.hideTimeZone && isFullscreen && (
        <TimePickerFooter timeZone={props.timeZone} onChangeTimeZone={props.onChangeTimeZone} />
      )}
    </div>
  );
};

export const TimePickerContent: React.FC<Props> = props => {
  const theme = useTheme();
  const isFullscreen = useMedia(`(min-width: ${theme.breakpoints.lg})`);

  return <TimePickerContentWithScreenSize {...props} isFullscreen={isFullscreen} />;
};

const NarrowScreenForm: React.FC<FormProps> = props => {
  if (!props.visible) {
    return null;
  }

  const theme = useTheme();
  const styles = getNarrowScreenStyles(theme);
  const isAbsolute = isDateTime(props.value.raw.from) || isDateTime(props.value.raw.to);
  const [collapsed, setCollapsed] = useState(isAbsolute);

  return (
    <>
      <div
        aria-label="TimePicker absolute time range"
        className={styles.header}
        onClick={() => setCollapsed(!collapsed)}
      >
        <TimePickerTitle>Absolute time range</TimePickerTitle>
        {<Icon name={collapsed ? 'angle-up' : 'angle-down'} />}
      </div>
      {collapsed && (
        <div className={styles.body}>
          <div className={styles.form}>
            <TimeRangeForm
              value={props.value}
              onApply={props.onChange}
              timeZone={props.timeZone}
              isFullscreen={false}
            />
          </div>
          {props.showHistory && (
            <TimeRangeList
              title="Recently used absolute ranges"
              options={props.historyOptions || []}
              onSelect={props.onChange}
              value={props.value}
              placeholderEmpty={null}
              timeZone={props.timeZone}
            />
          )}
        </div>
      )}
    </>
  );
};

const FullScreenForm: React.FC<FormProps> = props => {
  if (!props.visible) {
    return null;
  }

  const theme = useTheme();
  const styles = getFullScreenStyles(theme);

  return (
    <>
      <div className={styles.container}>
        <div aria-label="TimePicker absolute time range" className={styles.title}>
          <TimePickerTitle>Absolute time range</TimePickerTitle>
        </div>
        <TimeRangeForm
          value={props.value}
          timeZone={props.timeZone}
          onApply={props.onChange}
          isFullscreen={true}
          isReversed={props.isReversed}
        />
      </div>
      {props.showHistory && (
        <div className={styles.recent}>
          <TimeRangeList
            title="Recently used absolute ranges"
            options={props.historyOptions || []}
            onSelect={props.onChange}
            value={props.value}
            placeholderEmpty={<EmptyRecentList />}
            timeZone={props.timeZone}
          />
        </div>
      )}
    </>
  );
};

const EmptyRecentList = memo(() => {
  const theme = useTheme();
  const styles = getEmptyListStyles(theme);

  return (
    <div className={styles.container}>
      <div>
        <span>
          It looks like you haven't used this timer picker before. As soon as you enter some time intervals, recently
          used intervals will appear here.
        </span>
      </div>
      <div>
        <a
          className={styles.link}
          href="https://grafana.com/docs/grafana/latest/dashboards/time-range-controls"
          target="_new"
        >
          Read the documentation
        </a>
        <span> to find out more about how to enter custom time ranges.</span>
      </div>
    </div>
  );
});

function mapToHistoryOptions(ranges?: TimeRange[], timeZone?: TimeZone): TimeOption[] {
  if (!Array.isArray(ranges) || ranges.length === 0) {
    return [];
  }
  return ranges.slice(ranges.length - 4).map(range => mapRangeToTimeOption(range, timeZone));
}
