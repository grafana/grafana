import React, { PropsWithChildren } from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme, SelectableValue, getTimeZoneInfo } from '@grafana/data';
import { useTheme } from '../../../themes/ThemeContext';
import { stylesFactory } from '../../../themes/stylesFactory';
import { Icon } from '../../Icon/Icon';
import { TimeZoneOffset } from './TimeZoneOffset';
import { TimeZoneDescription } from './TimeZoneDescription';
import { TimeZoneTitle } from './TimeZoneTitle';
import isString from 'lodash/isString';

interface Props {
  isFocused: boolean;
  isSelected: boolean;
  innerProps: any;
  data: SelectableZone;
}

const offsetClassName = 'tz-utc-offset';

export interface SelectableZone extends SelectableValue<string> {
  searchIndex: string;
}

export const WideTimeZoneOption: React.FC<PropsWithChildren<Props>> = (props, ref) => {
  const { children, innerProps, data, isSelected, isFocused } = props;
  const theme = useTheme();
  const styles = getStyles(theme);
  const timestamp = Date.now();
  const containerStyles = cx(styles.container, isFocused && styles.containerFocused);

  if (!isString(data.value)) {
    return null;
  }

  return (
    <div className={containerStyles} {...innerProps} aria-label="Select option">
      <div className={cx(styles.leftColumn, styles.row)}>
        <div className={cx(styles.leftColumn, styles.wideRow)}>
          <TimeZoneTitle title={children} />
          <div className={styles.spacer} />
          <TimeZoneDescription info={getTimeZoneInfo(data.value, timestamp)} />
        </div>
        <div className={styles.rightColumn}>
          <TimeZoneOffset timeZone={data.value} timestamp={timestamp} className={offsetClassName} />
          {isSelected && (
            <span>
              <Icon name="check" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const CompactTimeZoneOption: React.FC<PropsWithChildren<Props>> = (props, ref) => {
  const { children, innerProps, data, isSelected, isFocused } = props;
  const theme = useTheme();
  const styles = getStyles(theme);
  const timestamp = Date.now();
  const containerStyles = cx(styles.container, isFocused && styles.containerFocused);

  if (!isString(data.value)) {
    return null;
  }

  return (
    <div className={containerStyles} {...innerProps} aria-label="Select option">
      <div className={styles.body}>
        <div className={styles.row}>
          <div className={styles.leftColumn}>
            <TimeZoneTitle title={children} />
          </div>
          <div className={styles.rightColumn}>
            {isSelected && (
              <span>
                <Icon name="check" />
              </span>
            )}
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.leftColumn}>
            <TimeZoneDescription info={getTimeZoneInfo(data.value, timestamp)} />
          </div>
          <div className={styles.rightColumn}>
            <TimeZoneOffset timestamp={timestamp} timeZone={data.value} className={offsetClassName} />
          </div>
        </div>
      </div>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const offsetHoverBg = theme.isDark ? theme.palette.gray05 : theme.palette.white;

  return {
    container: css`
      display: flex;
      align-items: center;
      flex-direction: row;
      flex-shrink: 0;
      white-space: nowrap;
      cursor: pointer;
      border-left: 2px solid transparent;
      padding: 6px 8px 4px;

      &:hover {
        background: ${theme.colors.dropdownOptionHoverBg};

        span.${offsetClassName} {
          background: ${offsetHoverBg};
        }
      }
    `,
    containerFocused: css`
      background: ${theme.colors.dropdownOptionHoverBg};
      border-image: linear-gradient(#f05a28 30%, #fbca0a 99%);
      border-image-slice: 1;
      border-style: solid;
      border-top: 0;
      border-right: 0;
      border-bottom: 0;
      border-left-width: 2px;

      span.${offsetClassName} {
        background: ${offsetHoverBg};
      }
    `,
    body: css`
      display: flex;
      font-weight: ${theme.typography.weight.semibold};
      flex-direction: column;
      flex-grow: 1;
    `,
    row: css`
      display: flex;
      flex-direction: row;
    `,
    leftColumn: css`
      flex-grow: 1;
      text-overflow: ellipsis;
    `,
    rightColumn: css`
      justify-content: flex-end;
      align-items: center;
    `,
    wideRow: css`
      display: flex;
      flex-direction: row;
      align-items: baseline;
    `,
    spacer: css`
      margin-left: 6px;
    `,
  };
});
