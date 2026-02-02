// BMC file
import { useEffect, useRef, useState } from 'react';

import { TimeRange } from '@grafana/data';
import { isWeekStart, TimeRangeInput } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { VariableLegend } from 'app/features/dashboard-scene/settings/variables/components/VariableLegend';
import { convertQuery2TimeRange } from 'app/features/variables/datepicker/utils';

interface DatePickerVariableFormProps {
  value?: string;
  onChange?: (val: TimeRange) => void;
  weekStart?: string;
  timeZone?: string;
}

export function DatePickerVariableForm({ value, onChange, weekStart, timeZone }: DatePickerVariableFormProps) {
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [timeRange, setTimeRange] = useState(() => convertQuery2TimeRange(value ?? ''));
  const [isReversed, setIsReversed] = useState(true);

  useEffect(() => {
    setTimeRange(convertQuery2TimeRange(value ?? ''));
  }, [value]);

  useEffect(() => {
    if (!value && onChange) {
      onChange(timeRange);
    }
  }, [value, onChange, timeRange]);

  useEffect(() => {
    if (datePickerRef.current) {
      setTimeout(() => {
        if (datePickerRef.current !== null) {
          const rect = datePickerRef.current.getBoundingClientRect();
          const distanceFromRight = window.innerWidth - rect.left;
          setIsReversed(distanceFromRight > 820);
        }
      }, 200);
    }
  }, [datePickerRef]);

  return (
    <>
      <VariableLegend>
        <Trans i18nKey="bmcgrafana.dashboards.settings.variables.editor.types.date-range.title">
          Select Time Range
        </Trans>
      </VariableLegend>
      <div ref={datePickerRef}>
        <TimeRangeInput
          clearable={true}
          value={timeRange}
          onChange={onChange ?? (() => {})}
          onChangeTimeZone={(tz: any) => console.log('timezone', tz)}
          hideQuickRanges={false}
          weekStart={weekStart && isWeekStart(weekStart) ? weekStart : undefined}
          timeZone={timeZone ?? 'browser'}
          isReversed={isReversed}
        />
      </div>
    </>
  );
}
