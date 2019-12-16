import React, { useState, memo } from 'react';
import { useMedia } from 'react-use';
import { css } from 'emotion';
import { useTheme, stylesFactory } from '../../../themes';
import { GrafanaTheme, TimeOption, TimeRange, TimeZone } from '@grafana/data';
import TimeRangeTitle from './TimePickerTitle';
import TimeRangeForm from './TimeRangeForm';
import { CustomScrollbar } from '../../CustomScrollbar/CustomScrollbar';
import TimeRangeList from './TimeRangeList';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      display: flex;
      background: ${theme.background.dropdown};
      box-shadow: 0px 4px 4px #c7d0d9;
      position: absolute;
      z-index: ${theme.zIndex.modal};
      width: 546px;
      height: 381px;
      top: 34px;
      right: 32px;

      @media only screen and (max-width: ${theme.breakpoints.lg}) {
        width: 218px;
      }
    `,
    leftSide: css`
      display: flex;
      flex-direction: column;
      border-right: 1px solid ${theme.colors.gray4};
      width: 60%;

      @media only screen and (max-width: ${theme.breakpoints.lg}) {
        display: none;
      }
    `,
    rightSide: css`
      width: 40% !important;

      @media only screen and (max-width: ${theme.breakpoints.lg}) {
        width: 100% !important;
      }
    `,
  };
});

const getNarrowScreenStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    header: css`
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid ${theme.colors.gray4};
      padding: 6px 9px 6px 9px;
    `,
    body: css`
      border-bottom: 1px solid ${theme.colors.gray4};
      background: #f7f8fa;
      box-shadow: inset 0px 2px 2px rgba(199, 208, 217, 0.5);
    `,
    form: css`
      padding: 6px 9px 6px 9px;
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
  return {
    container: css`
      background-color: #f7f8fa;
      padding: 12px;
      margin: 12px;
    `,
    section: css`
      margin-bottom: 12px;
    `,
    link: css`
      color: ${theme.colors.linkExternal};
    `,
  };
});

interface Props {
  value: TimeRange;
  onChange: (timeRange: TimeRange) => void;
  timeZone?: TimeZone;
  quickOptions?: TimeOption[];
  otherOptions?: TimeOption[];
}

interface FormProps extends Props {
  visible: boolean;
}

const TimePickerExtended: React.FC<Props> = props => {
  const theme = useTheme();
  const isFullscreen = useMedia(`(min-width: ${theme.breakpoints.lg})`);
  const styles = getStyles(theme);
  const { quickOptions = [], otherOptions = [] } = props;

  return (
    <div className={styles.container}>
      <div className={styles.leftSide}>
        <FullScreenForm {...props} visible={isFullscreen} />
      </div>
      <CustomScrollbar className={styles.rightSide}>
        <NarrowScreenForm {...props} visible={!isFullscreen} />
        <TimeRangeList
          title="Relative time range from now"
          options={quickOptions}
          onSelect={props.onChange}
          value={props.value}
        />
        <TimeRangeList
          title="Other relative range"
          options={otherOptions}
          onSelect={props.onChange}
          value={props.value}
        />
      </CustomScrollbar>
    </div>
  );
};

const NarrowScreenForm = memo<FormProps>(props => {
  if (!props.visible) {
    return null;
  }

  const theme = useTheme();
  const styles = getNarrowScreenStyles(theme);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      <div className={styles.header} onClick={() => setCollapsed(!collapsed)}>
        <TimeRangeTitle>Absolute time range</TimeRangeTitle>
        {collapsed ? <i className="fa fa-caret-up" /> : <i className="fa fa-caret-down" />}
      </div>
      {collapsed && (
        <div className={styles.body}>
          <div className={styles.form}>
            <TimeRangeForm
              value={props.value}
              onApply={props.onChange}
              timeZone={props.timeZone}
              showCalendarOn="ClickOnInputButton"
            />
          </div>
          <TimeRangeList
            title="Recently used absolute ranges"
            options={[]}
            onSelect={props.onChange}
            value={props.value}
            placeholderEmpty={null}
          />
        </div>
      )}
    </>
  );
});

const FullScreenForm = memo<FormProps>(props => {
  if (!props.visible) {
    return null;
  }

  const theme = useTheme();
  const styles = getFullScreenStyles(theme);

  return (
    <>
      <div className={styles.container}>
        <div className={styles.title}>
          <TimeRangeTitle>Absolute time range</TimeRangeTitle>
        </div>
        <TimeRangeForm
          value={props.value}
          timeZone={props.timeZone}
          onApply={props.onChange}
          showCalendarOn="FocusOnInput"
        />
      </div>
      <div className={styles.recent}>
        <TimeRangeList
          title="Recently used absolute ranges"
          options={[]}
          onSelect={props.onChange}
          value={props.value}
          placeholderEmpty={<EmptyRecentList />}
        />
      </div>
    </>
  );
});

const EmptyRecentList = memo(() => {
  const theme = useTheme();
  const styles = getEmptyListStyles(theme);

  return (
    <div className={styles.container}>
      <div className={styles.section}>
        <span>
          It looks like you haven't used this timer picker before. As soon as you enter some time intervals, recently
          used intervals will appear here.
        </span>
      </div>
      <div>
        <a className={styles.link} href="#" target="_new">
          Read the documentation
        </a>
        <span> to find out more about how to enter custom tiem ranges.</span>
      </div>
    </div>
  );
});

export default TimePickerExtended;
