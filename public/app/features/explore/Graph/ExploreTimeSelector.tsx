import { SelectableValue } from '@grafana/data';
import { RadioButtonGroup } from '@grafana/ui';
import { EXPLORE_TIME_RANGE_OPTIONS, ExploreTimeRangeOptions} from 'app/types';

const ALL_TIME_SELECTOR_OPTIONS: Array<SelectableValue<ExploreTimeRangeOptions>> = EXPLORE_TIME_RANGE_OPTIONS.map((style) => ({
  value: style,
  // capital-case it and switch `_` to ` `
  label: style[0].toUpperCase() + style.slice(1).replace(/_/, ' '),
}));

type Props = {
  timeRange: ExploreTimeRangeOptions;
  onChangeTimeRange: (timeRange: ExploreTimeRangeOptions) => void;
};

export function ExploreGraphTimeSelector(props: Props) {
  const { timeRange, onChangeTimeRange } = props;
  return (
    <RadioButtonGroup className="explore-time-selector" size="sm" options={ALL_TIME_SELECTOR_OPTIONS} value={timeRange} onChange={onChangeTimeRange} />
  );
}
