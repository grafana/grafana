// BMC file
import { TimeRange } from '@grafana/data';
import { DatePickerVariable } from 'app/features/dashboard-scene/bmc/variables/datepicker/DatePickerVariable';
import { getDashboardSceneFor } from 'app/features/dashboard-scene/utils/utils';

import { DatePickerVariableForm } from '../components/DatePickerVariableForm';

interface DatePickerVariableEditorProps {
  variable: DatePickerVariable;
  onChange: (variable: DatePickerVariable) => void;
}

export function DatePickerVariableEditor({ variable }: DatePickerVariableEditorProps) {
  const { value } = variable.useState();
  const dashboardScene = getDashboardSceneFor(variable);
  const $timeRange = dashboardScene?.state.$timeRange;
  const { weekStart, timeZone } = $timeRange?.useState() ?? {};

  const onTimeRangeChange = (val: TimeRange) => {
    variable.setValue(val);
  };

  return (
    <DatePickerVariableForm value={value} onChange={onTimeRangeChange} weekStart={weekStart} timeZone={timeZone} />
  );
}
