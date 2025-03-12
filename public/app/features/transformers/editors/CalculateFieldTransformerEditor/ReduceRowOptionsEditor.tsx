import { ReducerID } from '@grafana/data';
import { CalculateFieldTransformerOptions, ReduceOptions } from '@grafana/data/internal';
import { FilterPill, HorizontalGroup, InlineField, StatsPicker } from '@grafana/ui';

import { LABEL_WIDTH } from './constants';

export const ReduceRowOptionsEditor = (props: {
  options: CalculateFieldTransformerOptions;
  names: string[];
  selected: string[];
  onChange: (options: CalculateFieldTransformerOptions) => void;
}) => {
  const { names, selected, onChange, options } = props;
  const { reduce } = options;

  const updateReduceOptions = (v: ReduceOptions) => {
    onChange({
      ...options,
      reduce: v,
    });
  };

  const onFieldToggle = (fieldName: string) => {
    if (selected.indexOf(fieldName) > -1) {
      onReduceFieldsChanged(selected.filter((s) => s !== fieldName));
    } else {
      onReduceFieldsChanged([...selected, fieldName]);
    }
  };

  const onReduceFieldsChanged = (selected: string[]) => {
    updateReduceOptions({
      ...reduce!,
      include: selected,
    });
  };

  const onStatsChange = (stats: string[]) => {
    const reducer = stats.length ? (stats[0] as ReducerID) : ReducerID.sum;

    const { reduce } = options;
    updateReduceOptions({ ...reduce, reducer });
  };

  return (
    <>
      <InlineField label="Operation" labelWidth={LABEL_WIDTH} grow={true}>
        <HorizontalGroup spacing="xs" align="flex-start" wrap>
          {names.map((o, i) => {
            return (
              <FilterPill
                key={`${o}/${i}`}
                onClick={() => {
                  onFieldToggle(o);
                }}
                label={o}
                selected={selected.indexOf(o) > -1}
              />
            );
          })}
        </HorizontalGroup>
      </InlineField>
      <InlineField label="Calculation" labelWidth={LABEL_WIDTH}>
        <StatsPicker
          allowMultiple={false}
          className="width-18"
          stats={[reduce?.reducer || ReducerID.sum]}
          onChange={onStatsChange}
          defaultStat={ReducerID.sum}
        />
      </InlineField>
    </>
  );
};
