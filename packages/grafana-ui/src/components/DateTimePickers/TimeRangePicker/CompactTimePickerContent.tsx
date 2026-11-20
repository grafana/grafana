import { css, cx } from '@emotion/css';
import { useId, useState } from 'react';

import { store, type GrafanaTheme2, type TimeOption } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../../themes/ThemeContext';
import { FilterInput } from '../../FilterInput/FilterInput';
import { Tab } from '../../Tabs/Tab';
import { TabsBar } from '../../Tabs/TabsBar';

import { type PropsWithScreenSize } from './TimePickerContent';
import { TimeRangeContent } from './TimeRangeContent';
import { TimeRangeList } from './TimeRangeList';
import { mapOptionToTimeRange } from './mapper';

type PickerTab = 'relative' | 'absolute';
const storageKey = 'grafana.timepicker.tab';

interface Props extends PropsWithScreenSize {
  quickOptions: TimeOption[];
  timeOption?: TimeOption;
  searchTerm: string;
  onSearch: (value: string) => void;
  historyOptions: TimeOption[];
}

export function CompactTimePickerContent(props: Props) {
  const { rememberLastTab = true, defaultTab = 'relative', hideQuickRanges } = props;
  const [selectedTab, setSelectedTab] = useState<PickerTab>(() => {
    if (rememberLastTab) {
      const saved = store.get(storageKey);
      if (saved === 'relative' || saved === 'absolute') {
        return saved;
      }
    }
    return defaultTab;
  });
  const activeTab = hideQuickRanges ? 'absolute' : selectedTab;
  const id = useId();
  const styles = useStyles2(getStyles);
  const selectTab = (tab: PickerTab) => {
    setSelectedTab(tab);
    if (rememberLastTab) {
      store.set(storageKey, tab);
    }
  };

  return (
    <div id="TimePickerContent" className={cx(styles.container, props.className)}>
      {!hideQuickRanges && (
        <TabsBar className={styles.tabs}>
          {(['relative', 'absolute'] as const).map((tab) => (
            <Tab
              key={tab}
              id={`${id}-${tab}`}
              label={
                tab === 'relative'
                  ? t('time-picker.tabs.relative', 'Relative')
                  : t('time-picker.tabs.absolute', 'Absolute')
              }
              active={activeTab === tab}
              tabIndex={activeTab === tab ? 0 : -1}
              aria-controls={`${id}-panel`}
              onChangeTab={() => selectTab(tab)}
              onKeyDown={(event) => {
                let nextTab: PickerTab;
                switch (event.key) {
                  case 'Home':
                    nextTab = 'relative';
                    break;
                  case 'End':
                    nextTab = 'absolute';
                    break;
                  case 'ArrowLeft':
                  case 'ArrowRight':
                    nextTab = tab === 'relative' ? 'absolute' : 'relative';
                    break;
                  default:
                    return;
                }

                event.preventDefault();
                selectTab(nextTab);
                document.getElementById(`${id}-${nextTab}`)?.focus();
              }}
            />
          ))}
        </TabsBar>
      )}
      <div
        role={hideQuickRanges ? undefined : 'tabpanel'}
        id={`${id}-panel`}
        aria-labelledby={hideQuickRanges ? undefined : `${id}-${activeTab}`}
        className={styles.content}
      >
        {activeTab === 'relative' ? (
          <>
            <FilterInput
              autoFocus
              width={0}
              value={props.searchTerm}
              onChange={props.onSearch}
              escapeRegex={false}
              placeholder={t('time-picker.tabs.search-placeholder', 'Type quick ranges e.g. 3h')}
              aria-label={t('time-picker.tabs.search-label', 'Search quick ranges')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing && props.quickOptions[0]) {
                  event.preventDefault();
                  props.onChange(mapOptionToTimeRange(props.quickOptions[0], props.timeZone));
                }
              }}
            />
            <TimeRangeList
              options={props.quickOptions}
              value={props.timeOption}
              onChange={(option) => props.onChange(mapOptionToTimeRange(option, props.timeZone))}
            />
          </>
        ) : (
          <>
            <TimeRangeContent
              value={props.value}
              onApply={props.onChange}
              timeZone={props.timeZone}
              fiscalYearStartMonth={props.fiscalYearStartMonth}
              onError={props.onError}
              weekStart={props.weekStart}
              isFullscreen={false}
              compact
              calendarDisplay={props.calendarDisplay === 'modal' ? 'modal' : 'inline'}
            />
            {props.showHistory && props.historyOptions.length > 0 && (
              <TimeRangeList
                title={t('time-picker.absolute.recent-title', 'Recently used absolute ranges')}
                options={props.historyOptions}
                onChange={(option) => props.onChange(mapOptionToTimeRange(option, props.timeZone))}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    width: 300,
    maxWidth: `calc(100vw - ${theme.spacing(2)})`,
    maxHeight: `calc(100dvh - ${theme.spacing(4)})`,
    display: 'flex',
    flexDirection: 'column',
    background: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.lg,
    boxShadow: theme.shadows.z3,
  }),
  tabs: css({ flexShrink: 0, padding: theme.spacing(0, 1) }),
  content: css({
    padding: theme.spacing(1),
    overflowY: 'auto',
    minHeight: 0,
  }),
});
