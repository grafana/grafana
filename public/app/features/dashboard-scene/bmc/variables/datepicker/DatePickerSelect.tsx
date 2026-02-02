import { useCallback, useEffect, useRef, useState } from 'react';

import { SceneComponentProps } from '@grafana/scenes';
import { isWeekStart, TimeRangeInput } from '@grafana/ui';
import { getDashboardSceneFor } from 'app/features/dashboard-scene/utils/utils';
import { convertQuery2TimeRange } from 'app/features/variables/datepicker/utils';

import { DatePickerVariable } from './DatePickerVariable';

export function DatePickerSelect({ model }: SceneComponentProps<DatePickerVariable>) {
  const { value } = model.useState();
  const dashboardScene = getDashboardSceneFor(model);
  const $timeRange = dashboardScene?.state.$timeRange;
  const { weekStart, timeZone } = $timeRange?.useState() ?? {};
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [isReversed, setIsReversed] = useState(true);
  const timeRange = convertQuery2TimeRange(value ?? '');

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

  const onChange = useCallback(
    (val: any) => {
      model.setValue(val);
    },
    [model]
  );

  return (
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
  );
}
