import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import {
  type GrafanaTheme2,
  isValidGrafanaDuration,
  rangeUtil,
  type TimeOption,
  type TimeRange,
  type TimeZone,
} from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../../themes/ThemeContext';
import { FilterInput } from '../../FilterInput/FilterInput';
import { Tab } from '../../Tabs/Tab';
import { TabsBar } from '../../Tabs/TabsBar';
import { type WeekStart } from '../WeekStartPicker';

import { TimeRangeContentInline } from './TimeRangeContentInline';
import { TimeRangeList } from './TimeRangeList';
import { mapOptionToTimeRange } from './mapper';

type TimeRangeTab = 'absolute' | 'relative';

export interface TimePickerContentTabsProps {
  value: TimeRange;
  onChange: (timeRange: TimeRange) => void;
  onError?: (error?: string) => void;
  timeZone?: TimeZone;
  quickOptions?: TimeOption[];
  weekStart?: WeekStart;
}

/**
 * Experimental copy of the narrow-screen TimePickerContent that switches between absolute and relative
 * ranges with tabs instead of a collapsible "Absolute time range" section.
 */
export const TimePickerContentTabs = ({
  value,
  onChange,
  onError,
  timeZone,
  quickOptions = [],
  weekStart,
}: TimePickerContentTabsProps) => {
  const styles = useStyles2(getStyles);
  const [activeTab, setActiveTab] = useState<TimeRangeTab>('relative');

  const [searchTerm, setSearchTerm] = useState('');

  const { filteredQuickOptions, customTimeOption } = useMemo(() => {
    const filtered = quickOptions.filter((o) => o.display.toLowerCase().includes(searchTerm.toLowerCase()));
    const customTimeOption = isValidGrafanaDuration(searchTerm) && rangeUtil.describeTextRange(searchTerm);

    if (customTimeOption && !filtered.some((o) => o.from === customTimeOption.from && o.to === customTimeOption.to)) {
      return { filteredQuickOptions: [customTimeOption, ...filtered], customTimeOption };
    }

    return { filteredQuickOptions: filtered, customTimeOption: undefined };
  }, [searchTerm, quickOptions]);

  const selectedOption = useMemo(
    () => customTimeOption || quickOptions.find((o) => o.from === value.raw.from && o.to === value.raw.to),
    [customTimeOption, quickOptions, value.raw.from, value.raw.to]
  );

  const onChangeTimeOption = (option: TimeOption) => onChange(mapOptionToTimeRange(option, timeZone));

  return (
    <div className={styles.container}>
      <TabsBar className={styles.tabs}>
        <Tab
          label={t('time-picker.tabs.relative', 'Relative')}
          active={activeTab === 'relative'}
          onChangeTab={() => setActiveTab('relative')}
        />
        <Tab
          label={t('time-picker.tabs.absolute', 'Absolute')}
          active={activeTab === 'absolute'}
          onChangeTab={() => setActiveTab('absolute')}
        />
      </TabsBar>
      {activeTab === 'absolute' ? (
        <div>
          <div className={styles.form}>
            <TimeRangeContentInline
              value={value}
              onApply={onChange}
              timeZone={timeZone}
              onError={onError}
              weekStart={weekStart}
            />
          </div>
        </div>
      ) : (
        <div>
          <div className={styles.filter}>
            <FilterInput
              width={0}
              value={searchTerm}
              onChange={setSearchTerm}
              escapeRegex={false}
              placeholder={t('time-picker.tabs.filter-placeholder', 'Type quick ranges e.g. 3h')}
            />
          </div>
          <TimeRangeList options={filteredQuickOptions} onChange={onChangeTimeOption} value={selectedOption} />
        </div>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    background: theme.colors.background.elevated,
    display: 'flex',
    flexDirection: 'column',
  }),
  tabs: css({
    padding: theme.spacing(0, 1),
  }),
  form: css({
    padding: theme.spacing(0.875, 0),
  }),
  filter: css({
    padding: theme.spacing(1),
  }),
});
