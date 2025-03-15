import { ReducerID, SelectableValue } from '@grafana/data';
import { CalculateFieldMode, CalculateFieldTransformerOptions, CumulativeOptions } from '@grafana/data/internal';
import { InlineField, Select, StatsPicker } from '@grafana/ui';

import { LABEL_WIDTH } from './constants';

export const CumulativeOptionsEditor = (props: {
  options: CalculateFieldTransformerOptions;
  names: string[];
  onChange: (options: CalculateFieldTransformerOptions) => void;
}) => {
  const { names, onChange, options } = props;
  const { cumulative } = options;
  const selectOptions = names.map((v) => ({ label: v, value: v }));

  const onCumulativeStatsChange = (stats: string[]) => {
    const reducer = stats.length ? (stats[0] as ReducerID) : ReducerID.sum;

    updateCumulativeOptions({ ...cumulative, reducer });
  };

  const updateCumulativeOptions = (v: CumulativeOptions) => {
    onChange({
      ...options,
      mode: CalculateFieldMode.CumulativeFunctions,
      cumulative: v,
    });
  };

  const onCumulativeFieldChange = (v: SelectableValue<string>) => {
    updateCumulativeOptions({
      ...cumulative!,
      field: v.value!,
    });
  };

  return (
    <>
      <InlineField label="Field" labelWidth={LABEL_WIDTH}>
        <Select
          placeholder="Field"
          options={selectOptions}
          className="min-width-18"
          value={cumulative?.field}
          onChange={onCumulativeFieldChange}
        />
      </InlineField>
      <InlineField label="Calculation" labelWidth={LABEL_WIDTH}>
        <StatsPicker
          allowMultiple={false}
          className="width-18"
          stats={[cumulative?.reducer || ReducerID.sum]}
          onChange={onCumulativeStatsChange}
          defaultStat={ReducerID.sum}
          filterOptions={(ext) => ext.id === ReducerID.sum || ext.id === ReducerID.mean}
        />
      </InlineField>
    </>
  );
};
