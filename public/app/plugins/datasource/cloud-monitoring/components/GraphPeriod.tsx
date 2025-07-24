import { SelectableValue } from '@grafana/data';
import { EditorField, EditorRow } from '@grafana/plugin-ui';
import { Stack, Switch } from '@grafana/ui';

import { GRAPH_PERIODS } from '../constants';

import { PeriodSelect } from './PeriodSelect';

export interface Props {
  refId: string;
  onChange: (period: string) => void;
  variableOptionGroup: SelectableValue<string>;
  graphPeriod?: string;
}

export const GraphPeriod = ({ refId, onChange, graphPeriod, variableOptionGroup }: Props) => {
  return (
    <EditorRow>
      <EditorField
        label="Graph period"
        htmlFor={`${refId}-graph-period`}
        tooltip={
          <>
            Set <code>graph_period</code> which forces a preferred period between points. Automatically set to the
            current interval if left blank.
          </>
        }
      >
        <Stack gap={1}>
          <Switch
            data-testid={`${refId}-switch-graph-period`}
            value={graphPeriod !== 'disabled'}
            onChange={(e) => onChange(e.currentTarget.checked ? '' : 'disabled')}
          />
          <PeriodSelect
            inputId={`${refId}-graph-period`}
            templateVariableOptions={variableOptionGroup.options}
            current={graphPeriod}
            onChange={onChange}
            disabled={graphPeriod === 'disabled'}
            aligmentPeriods={GRAPH_PERIODS}
          />
        </Stack>
      </EditorField>
    </EditorRow>
  );
};
