import { css } from '@emotion/css';
import { useState } from 'react';

import { dateTime, type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Stack, Text, useStyles2 } from '@grafana/ui';
import { TimePickerContent, TimePickerContentTabs } from '@grafana/ui/internal';
import { Page } from 'app/core/components/Page/Page';

const NARROW_WIDTH = 400;
const PICKER_WIDTH = 262;

const QUICK_OPTIONS = [
  { from: 'now-5m', to: 'now', display: 'Last 5 minutes' },
  { from: 'now-15m', to: 'now', display: 'Last 15 minutes' },
  { from: 'now-1h', to: 'now', display: 'Last 1 hour' },
  { from: 'now-6h', to: 'now', display: 'Last 6 hours' },
  { from: 'now-24h', to: 'now', display: 'Last 24 hours' },
  { from: 'now-7d', to: 'now', display: 'Last 7 days' },
];

const HISTORY: TimeRange[] = [
  {
    from: dateTime('2026-11-10T09:00:00Z'),
    to: dateTime('2026-11-10T17:00:00Z'),
    raw: { from: dateTime('2026-11-10T09:00:00Z'), to: dateTime('2026-11-10T17:00:00Z') },
  },
  {
    from: dateTime('2026-11-03T00:00:00Z'),
    to: dateTime('2026-11-04T00:00:00Z'),
    raw: { from: dateTime('2026-11-03T00:00:00Z'), to: dateTime('2026-11-04T00:00:00Z') },
  },
];

function getInitialRange(): TimeRange {
  const now = dateTime();
  return { from: dateTime(now).subtract(6, 'hours'), to: now, raw: { from: 'now-6h', to: 'now' } };
}

export default function TimePickerPlayground() {
  const styles = useStyles2(getStyles);
  const [value, setValue] = useState<TimeRange>(getInitialRange);
  const [timeZone, setTimeZone] = useState('browser');
  const changes = [
    t(
      'theme-playground.time-picker.change-tabs',
      'Relative and Absolute are tabs instead of a collapsible "Absolute time range" section, with Relative open by default.'
    ),
    t(
      'theme-playground.time-picker.change-search',
      'The quick range search is only on the Relative tab, with the placeholder "Type quick ranges e.g. 3h".'
    ),
    t(
      'theme-playground.time-picker.change-recent',
      'The "Recently used absolute ranges" list is removed from the Absolute tab.'
    ),
    t(
      'theme-playground.time-picker.change-calendar',
      'The calendar opens inside the picker instead of in a modal, replacing the inputs and buttons and keeping only Cancel and Apply.'
    ),
    t(
      'theme-playground.time-picker.change-layout',
      'The calendar has a rounded border, the From and To inputs fill the container width and the Apply button is aligned to the right.'
    ),
  ];

  return (
    <Page
      navId="theme-playground"
      pageNav={{ text: t('theme-playground.time-picker.title', 'Time picker (responsive)') }}
    >
      <Page.Contents>
        <Stack direction="column" gap={2}>
          <Text variant="body" color="secondary">
            <Trans i18nKey="theme-playground.time-picker.description">
              The time picker below is forced into its narrow, single-column layout regardless of the real viewport
              width.
            </Trans>
          </Text>
          <Stack direction="row" gap={4} wrap="wrap" alignItems="flex-start">
            <Stack direction="column" gap={1}>
              <Text weight="medium">{t('theme-playground.time-picker.current', 'Current: collapsible section')}</Text>
              <div className={styles.frame} style={{ width: PICKER_WIDTH }}>
                <TimePickerContent
                  value={value}
                  onChange={setValue}
                  timeZone={timeZone}
                  onChangeTimeZone={setTimeZone}
                  widthOverride={NARROW_WIDTH}
                  quickOptions={QUICK_OPTIONS}
                  history={HISTORY}
                  showHistory
                />
              </div>
            </Stack>
            <Stack direction="column" gap={1}>
              <Text weight="medium">
                {t('theme-playground.time-picker.tabs', 'Proposed: Absolute / Relative tabs')}
              </Text>
              <div className={styles.frame} style={{ width: PICKER_WIDTH }}>
                <TimePickerContentTabs
                  value={value}
                  onChange={setValue}
                  timeZone={timeZone}
                  quickOptions={QUICK_OPTIONS}
                />
              </div>
            </Stack>
          </Stack>
          <Stack direction="column" gap={1}>
            <Text weight="medium">
              {t('theme-playground.time-picker.changes-title', 'Main changes in the proposal')}
            </Text>
            <ul className={styles.changes}>
              {changes.map((change) => (
                <li key={change}>
                  <Text color="secondary">{change}</Text>
                </li>
              ))}
            </ul>
          </Stack>
        </Stack>
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  changes: css({
    margin: 0,
    paddingLeft: theme.spacing(3),
    maxWidth: 640,
  }),
  frame: css({
    maxWidth: '100%',
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.primary,
    // The picker's body has a fixed height, so let it grow to fit its content instead of scrolling internally.
    '#TimePickerContent > div': {
      height: 'auto',
      maxHeight: 'none',
    },
  }),
});
