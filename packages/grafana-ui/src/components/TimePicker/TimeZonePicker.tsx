import React, { useMemo, useCallback } from 'react';
import { cx, css } from 'emotion';
import { toLower } from 'lodash';
import {
  SelectableValue,
  getTimeZoneInfo,
  TimeZoneInfo,
  dateTimeFormat,
  getTimeZoneGroups,
  TimeZoneGroup,
  GrafanaTheme,
} from '@grafana/data';
import { useTheme, stylesFactory } from '../../themes';
import { getSelectStyles } from '../Select/getSelectStyles';
import { Icon } from '../Icon/Icon';
import { Select } from '../Select/Select';

export interface Props {
  value: string;
  width?: number;
  onChange: (newValue: string) => void;
}

interface SelectableZoneGroup extends SelectableValue<string> {
  options: SelectableZone[];
}
interface SelectableZone extends SelectableValue<string> {
  searchIndex: string;
  utcOffset: string;
  localTime: string;
}
interface TimeZoneOptionProps {
  isFocused: boolean;
  isSelected: boolean;
  innerProps: any;
  data: SelectableZone;
}

const getSelectOptionGroupStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    header: css`
      padding: 7px 10px;
      width: 100%;
      border-top: 1px solid ${theme.colors.border1};
      text-transform: capitalize;
    `,
    label: css`
      font-size: ${theme.typography.size.sm};
      color: ${theme.colors.textWeak};
      font-weight: ${theme.typography.weight.semibold};
    `,
  };
});

export const Group: React.FC<any> = props => {
  const theme = useTheme();
  const { children, label } = props;
  const styles = getSelectOptionGroupStyles(theme);

  if (!label) {
    return <div>{children}</div>;
  }

  return (
    <div>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
      </div>
      {children}
    </div>
  );
};

export const Option = React.forwardRef<HTMLDivElement, React.PropsWithChildren<TimeZoneOptionProps>>((props, ref) => {
  const theme = useTheme();
  const styles = getSelectStyles(theme);
  const { children, innerProps, data, isSelected, isFocused } = props;
  const containerStyle = cx(styles.option, isFocused && styles.optionFocused);

  return (
    <div ref={ref} className={containerStyle} {...innerProps} aria-label="Select option">
      <div className={styles.optionBody}>
        <div
          className={css`
            display: flex;
            flex-direction: row;
          `}
        >
          <div
            className={css`
              flex-grow: 1;
            `}
          >
            <span>{children}</span>
          </div>
          <div>
            {isSelected && (
              <span>
                <Icon name="check" />
              </span>
            )}
          </div>
        </div>
        <div
          className={css`
            display: flex;
            flex-direction: row;
          `}
        >
          <div
            className={css`
              flex-grow: 1;
            `}
          >
            {data.description && <div className={styles.optionDescription}>{data.description}</div>}
          </div>
          <div
            className={css`
              justify-content: flex-end;
            `}
          >
            <span>{data.localTime}</span>
            <span>{data.utcOffset}</span>
          </div>
        </div>
      </div>
    </div>
  );
});

export const TimeZonePicker: React.FC<Props> = ({ onChange, value, width }) => {
  const groupedTimeZones = useTimeZones();
  const filterBySearchIndex = useFilterBySearchIndex();

  return (
    <Select
      width={width}
      filterOption={filterBySearchIndex}
      options={groupedTimeZones}
      onChange={() => {}}
      components={{ Option, Group }}
    />
  );
};

const useTimeZones = (): SelectableZoneGroup[] => {
  const now = Date.now();

  return getTimeZoneGroups(true).map((group: TimeZoneGroup) => {
    const options = group.zones.reduce((options: SelectableZone[], zone) => {
      const info = getTimeZoneInfo(zone, now);

      if (!info) {
        return options;
      }

      const localTime = dateTimeFormat(now, {
        timeZone: info.zone,
        format: 'HH:mm',
      });

      const utcOffset = formatUtcOffset(now, info.zone);

      options.push({
        label: zone,
        value: zone,
        description: useDescription(info),
        searchIndex: useSearchIndex(info, localTime, utcOffset),
        utcOffset: utcOffset,
        localTime: localTime,
      });

      return options;
    }, []);

    return {
      label: group.name,
      options,
    };
  });
};

const useDescription = (info: TimeZoneInfo): string => {
  return useMemo(() => {
    const parts: string[] = [];

    if (info.countries.length > 0) {
      const country = info.countries[0];
      parts.push(country.name);
    }

    if (info.abbreviation) {
      parts.push(info.abbreviation);
    }

    return parts.join(', ');
  }, [info.zone]);
};

const useFilterBySearchIndex = () => {
  return useCallback((option: SelectableValue, searchQuery: string) => {
    if (!searchQuery || !option.data || !option.data.searchIndex) {
      return true;
    }
    return option.data.searchIndex.indexOf(toLower(searchQuery)) > -1;
  }, []);
};

const useSearchIndex = (info: TimeZoneInfo, localTime: string, utcOffset: string): string => {
  const baseIndex = useMemo(() => {
    const parts: string[] = [toLower(info.zone), toLower(info.abbreviation), utcOffset];

    for (const country of info.countries) {
      parts.push(toLower(country.name));
      parts.push(toLower(country.code));
    }

    return parts.join('|');
  }, [info.zone, info.abbreviation, info.offsetInMins]);

  return `${baseIndex}|${localTime}`;
};

const formatUtcOffset = (timestamp: number, zone: string): string => {
  const offset = dateTimeFormat(timestamp, {
    timeZone: zone,
    format: 'Z',
  });

  if (offset === '+00:00') {
    return 'UTC';
  }
  return `UTC${offset}`;
};
