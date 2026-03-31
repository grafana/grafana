import { css, keyframes } from '@emotion/css';
import { useClick, useDismiss, useFloating, useInteractions } from '@floating-ui/react';
import { FocusScope } from '@react-aria/focus';
import { useEffect, useMemo, useRef, useState } from 'react';

import { type GrafanaTheme2, type TimeRange, dateMath, makeTimeRange, rangeUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  type SceneComponentProps,
  SceneObjectBase,
  type SceneObjectState,
  SceneObjectUrlSyncConfig,
  type SceneObjectUrlValues,
  sceneGraph,
} from '@grafana/scenes';
import { useTimeRange } from '@grafana/scenes-react';
import { Box, Button, Icon, RadioButtonGroup, Text, TimePickerContent, getQuickOptions, useStyles2 } from '@grafana/ui';

import { defaultTimeRange } from './utils';

const LIVE_REFRESH_INTERVAL_MS = 15_000;

export type TriageTimeMode = 'live' | 'history';

export const TRIAGE_TIME_MODE_KEY = 'triage-time-mode';

interface TriageTimeModeControlState extends SceneObjectState {
  mode: TriageTimeMode;
}

export class TriageTimeModeControl extends SceneObjectBase<TriageTimeModeControlState> {
  public static Component = TriageTimeModeControlRenderer;

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['triageMode'] });

  constructor(state: Partial<TriageTimeModeControlState> & { key?: string }) {
    super({ mode: 'live', ...state, key: state.key ?? TRIAGE_TIME_MODE_KEY });
  }

  getUrlState(): SceneObjectUrlValues {
    return { triageMode: this.state.mode === 'live' ? undefined : this.state.mode };
  }

  updateFromUrl(values: SceneObjectUrlValues): void {
    const mode = values.triageMode;
    if (mode === 'history') {
      this.setState({ mode: 'history' });
    } else {
      this.setState({ mode: 'live' });
    }
  }

  public setMode(mode: TriageTimeMode) {
    this.setState({ mode });

    if (mode === 'live') {
      const timeRange = sceneGraph.getTimeRange(this);
      const from = dateMath.parse(defaultTimeRange.from, false);
      const to = dateMath.parse(defaultTimeRange.to, true);
      if (from && to) {
        timeRange.onTimeRangeChange(makeTimeRange(from, to));
      }
    }
  }
}

function TriageTimeModeControlRenderer({ model }: SceneComponentProps<TriageTimeModeControl>) {
  const { mode } = model.useState();
  const [timeRange] = useTimeRange();
  const styles = useStyles2(getStyles);

  const modeOptions = useMemo(
    () => [
      { label: t('alerting.triage.time-mode.live', 'Live'), value: 'live' as const },
      { label: t('alerting.triage.time-mode.history', 'History'), value: 'history' as const },
    ],
    []
  );
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownMode, setDropdownMode] = useState<TriageTimeMode>(mode);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync dropdown mode when opening
  useEffect(() => {
    if (isOpen) {
      setDropdownMode(mode);
    }
  }, [isOpen, mode]);

  // Auto-refresh in live mode
  useEffect(() => {
    if (mode === 'live') {
      refreshIntervalRef.current = setInterval(() => {
        sceneGraph.getTimeRange(model).onRefresh();
      }, LIVE_REFRESH_INTERVAL_MS);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
      };
    }

    return undefined;
  }, [mode, model]);

  const { refs, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
  });

  const click = useClick(context);
  const dismiss = useDismiss(context, {
    bubbles: { outsidePress: false },
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

  const quickOptions = useMemo(() => getQuickOptions(), []);
  const timeZone = sceneGraph.getTimeRange(model).getTimeZone();

  const handleRadioChange = (newMode: TriageTimeMode) => {
    if (newMode === 'live') {
      model.setMode('live');
      setIsOpen(false);
    } else {
      setDropdownMode('history');
    }
  };

  const handleTimeRangeChange = (newTimeRange: TimeRange) => {
    const sceneTimeRange = sceneGraph.getTimeRange(model);
    sceneTimeRange.onTimeRangeChange(newTimeRange);
    model.setState({ mode: 'history' });
    setIsOpen(false);
  };

  const handleTimeZoneChange = (newTimeZone: string) => {
    const sceneTimeRange = sceneGraph.getTimeRange(model);
    sceneTimeRange.setState({ timeZone: newTimeZone });
  };

  const currentTimeRangeLabel = rangeUtil.describeTimeRange(timeRange.raw);

  return (
    <div className={styles.container}>
      <div ref={refs.setReference} {...getReferenceProps()}>
        {mode === 'live' ? (
          <Button variant="secondary" size="md" className={styles.liveButton}>
            <span className={styles.liveIndicator} />
            <span className={styles.liveText}>{t('alerting.triage.time-mode.live', 'Live')}</span>
            <Icon name="angle-down" />
          </Button>
        ) : (
          <Button variant="secondary" size="md" icon="clock-nine">
            {currentTimeRangeLabel}
            <Icon name="angle-down" className={styles.chevron} />
          </Button>
        )}
      </div>

      {isOpen && (
        <FocusScope contain autoFocus restoreFocus>
          <div ref={refs.setFloating} className={styles.dropdownPanel} {...getFloatingProps()}>
            <Box paddingBottom={1} display="flex" justifyContent="flex-end">
              <RadioButtonGroup<TriageTimeMode>
                options={modeOptions}
                value={dropdownMode}
                onChange={handleRadioChange}
                size="md"
              />
            </Box>

            {dropdownMode === 'live' ? (
              <Box padding={2}>
                <Text color="secondary">
                  {t(
                    'alerting.triage.time-mode.live-description',
                    'Showing currently active alerts only. Content auto-refreshes every 15 seconds.'
                  )}
                </Text>
              </Box>
            ) : (
              <TimePickerContent
                value={timeRange}
                onChange={handleTimeRangeChange}
                timeZone={timeZone}
                quickOptions={quickOptions}
                onChangeTimeZone={handleTimeZoneChange}
                showHistory
                className={styles.timePickerReset}
              />
            )}
          </div>
        </FocusScope>
      )}
    </div>
  );
}

const spin = keyframes`
  0% { opacity: 1; }
  100% { opacity: 0.3; }
`;

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      position: 'relative',
    }),
    liveButton: css({
      '& > span': {
        gap: theme.spacing(1),
      },
    }),
    liveIndicator: css({
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: theme.shape.radius.circle,
      backgroundColor: theme.colors.success.main,
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${spin} 1.5s ease-in-out infinite alternate`,
      },
    }),
    liveText: css({
      color: theme.colors.success.text,
    }),
    chevron: css({
      marginLeft: theme.spacing(0.5),
    }),
    dropdownPanel: css({
      position: 'absolute',
      right: 0,
      top: '116%',
      zIndex: theme.zIndex.dropdown,
      width: 546,
      backgroundColor: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z3,
      padding: theme.spacing(1),
    }),
    timePickerReset: css({
      border: 'none',
      boxShadow: 'none',
      background: 'transparent',
      borderRadius: 'unset',
      width: '100%',
    }),
  };
}
