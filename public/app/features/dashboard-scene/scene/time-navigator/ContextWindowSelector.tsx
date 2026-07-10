import React, { useEffect, useRef, useState } from 'react';

import { dateTime } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, DatePickerWithInput, IconButton, Input } from '@grafana/ui';

import { durationToMs } from './duration';
import { type TimeRangeMs } from './timeModel';

interface Props {
  /** The current context window, used to seed the absolute-range inputs. */
  contextWindow: TimeRangeMs;
  /** Apply a relative context window that extends the dashboard range by the given duration each side. */
  onApplyRelative: (duration: string) => void;
  /** Apply an absolute context window. */
  onApplyAbsolute: (range: TimeRangeMs) => void;
  onClose: () => void;
}

// The presets extend the current selection by the given duration on EACH side (see extendedContext), so
// they are labelled as "± <duration>" rather than as absolute "Last N" windows, which they are not.
const PRESETS = [
  { label: 'Same as time picker', value: '0h' },
  { label: '± 24 hours', value: '24h' },
  { label: '± 1 week', value: '7d' },
  { label: '± 2 weeks', value: '14d' },
  { label: '± 30 days', value: '30d' },
];

export const ContextWindowSelector: React.FC<Props> = ({
  contextWindow,
  onApplyRelative,
  onApplyAbsolute,
  onClose,
}) => {
  const [fromText, setFromText] = useState(() => dateTime(contextWindow.from).toISOString());
  const [toText, setToText] = useState(() => dateTime(contextWindow.to).toISOString());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && event.target instanceof Node && !wrapperRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const applyRelative = (duration: string) => {
    if (durationToMs(duration) == null) {
      return; // ignore invalid durations; keep the popover open so it can be corrected
    }
    onApplyRelative(duration);
    onClose();
  };

  const applyAbsolute = () => {
    const from = dateTime(fromText).valueOf();
    const to = dateTime(toText).valueOf();
    if (Number.isFinite(from) && Number.isFinite(to) && from < to) {
      onApplyAbsolute({ from, to });
      onClose();
    }
  };

  return (
    <div ref={wrapperRef} style={{ padding: 10, width: 350 }}>
      {PRESETS.map((opt) => (
        <Button key={opt.value} fullWidth variant="secondary" size="sm" onClick={() => applyRelative(opt.value)}>
          {opt.label}
        </Button>
      ))}

      <div style={{ marginTop: 16 }}>
        <Input
          width={25}
          placeholder={t('time-navigator.custom-duration-placeholder', 'Custom duration (e.g. 12h)')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              applyRelative(e.currentTarget.value);
            }
          }}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ marginRight: 6 }}>{t('time-navigator.from-label', 'From:')}</span>
          <Input width={25} value={fromText} onChange={(e) => setFromText(e.currentTarget.value)} />
          <IconButton
            name="calendar-alt"
            tooltip={t('time-navigator.pick-from-date', 'Pick a from date')}
            size="sm"
            variant="secondary"
            onClick={() => setShowFromPicker((v) => !v)}
          />
        </div>
        {showFromPicker && (
          <DatePickerWithInput
            value={fromText}
            onChange={(val) => setFromText(val instanceof Date ? val.toISOString() : val)}
          />
        )}

        <div style={{ display: 'flex', alignItems: 'center', margin: '10px 0 6px' }}>
          <span style={{ marginRight: 6 }}>{t('time-navigator.to-label', 'To:')}</span>
          <Input width={25} value={toText} onChange={(e) => setToText(e.currentTarget.value)} />
          <IconButton
            name="calendar-alt"
            tooltip={t('time-navigator.pick-to-date', 'Pick a to date')}
            size="sm"
            variant="secondary"
            onClick={() => setShowToPicker((v) => !v)}
          />
        </div>
        {showToPicker && (
          <DatePickerWithInput
            value={toText}
            onChange={(val) => setToText(val instanceof Date ? val.toISOString() : val)}
          />
        )}

        <Button fullWidth size="sm" variant="primary" onClick={applyAbsolute} style={{ marginTop: 10 }}>
          {t('time-navigator.apply-absolute-range', 'Apply Absolute Range')}
        </Button>
      </div>
    </div>
  );
};
