import { ReactElement, useCallback, useEffect } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { TimeRange, DatePickerVariableModel } from '@grafana/data';
import { VerticalGroup, TimeRangeInput, isWeekStart } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { StoreState } from 'app/types';

import { VariableLegend } from '../../dashboard-scene/settings/variables/components/VariableLegend';
import { VariableEditorProps } from '../editor/types';

import { getDefaultTimeRange, convertQuery2TimeRange, convertTimeRange2Query } from './utils';

const mapStateToProps = (state: StoreState) => ({
  dashboard: state.dashboard.getModel(),
});

interface OwnProps extends VariableEditorProps<DatePickerVariableModel> {}
const connector = connect(mapStateToProps, {});
type connectedProps = ConnectedProps<typeof connector>;
type Props = OwnProps & connectedProps;

const DatePickerVariableEditorUnconnected = (props: Props): ReactElement => {
  const {
    onPropChange,
    variable: { query },
    dashboard,
  } = props;
  useEffect(() => {
    if (!query) {
      onPropChange({ propName: 'query', propValue: convertTimeRange2Query(), updateOptions: true });
    }
  });
  const updateVariable = useCallback(
    (val: TimeRange, updateOptions: boolean) => {
      onPropChange({ propName: 'query', propValue: convertTimeRange2Query(val), updateOptions });
    },
    [onPropChange]
  );
  const onChange = useCallback((val: TimeRange) => updateVariable(val, true), [updateVariable]);

  let timeRange: TimeRange;
  if (query) {
    timeRange = convertQuery2TimeRange(query, dashboard?.getTimezone());
  } else {
    timeRange = getDefaultTimeRange();
  }

  {
    /*BMC Change: To enable localization for below text*/
  }
  return (
    <VerticalGroup spacing="xs">
      <VariableLegend>
        <Trans i18nKey="bmcgrafana.dashboards.settings.variables.editor.types.date-range.title">
          Select Time Range
        </Trans>
      </VariableLegend>
      <div>
        <TimeRangeInput
          clearable={true}
          value={timeRange}
          timeZone={dashboard?.getTimezone() ?? 'browser'}
          onChange={onChange}
          onChangeTimeZone={(tz: any) => console.log('timezone', tz)}
          hideQuickRanges={false}
          weekStart={isWeekStart(dashboard?.weekStart) ? dashboard.weekStart : undefined}
        />
      </div>
    </VerticalGroup>
  );
};

export const DatePickerVariableEditor = connector(DatePickerVariableEditorUnconnected);
