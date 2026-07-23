import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { RadioButtonGroup, UnitPicker } from '@grafana/ui';
import { EXPLORE_GRAPH_STYLES, type ExploreGraphStyle } from 'app/types/explore';

const ALL_GRAPH_STYLE_OPTIONS: Array<SelectableValue<ExploreGraphStyle>> = EXPLORE_GRAPH_STYLES.map((style) => ({
  value: style,
  // capital-case it and switch `_` to ` `
  label: style[0].toUpperCase() + style.slice(1).replace(/_/, ' '),
}));

type Props = {
  graphStyle: ExploreGraphStyle;
  onChangeGraphStyle: (style: ExploreGraphStyle) => void;
  unit?: string;
  onChangeUnit: (unit: string | undefined) => void;
};

export function ExploreGraphLabel(props: Props) {
  const { graphStyle, onChangeGraphStyle, unit, onChangeUnit } = props;
  return (
    <>
      <UnitPicker
        value={unit}
        onChange={onChangeUnit}
        placeholder={t('explore.graph-label.unit-placeholder', 'Unit')}
      />
      <RadioButtonGroup size="sm" options={ALL_GRAPH_STYLE_OPTIONS} value={graphStyle} onChange={onChangeGraphStyle} />
    </>
  );
}
