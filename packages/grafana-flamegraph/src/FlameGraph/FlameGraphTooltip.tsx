import { css } from '@emotion/css';

import { type DisplayValue, getValueFormat, type ValueFormatter } from '@grafana/data';
import { InteractiveTable, Portal, useStyles2, VizTooltipContainer } from '@grafana/ui';

import { ProfileTooltipContent } from '../ProfileTooltipContent';
import { ProfileTooltipDetails } from '../ProfileTooltipDetails';
import { type ProfileTooltipData } from '../types';
import { getProfileTooltipData } from '../utils';

import { type CollapseConfig, type FlameGraphDataContainer, type LevelItem } from './dataTransform';

type Props = {
  data: FlameGraphDataContainer;
  totalTicks: number;
  position?: { x: number; y: number };
  item?: LevelItem;
  collapseConfig?: CollapseConfig;
};

const FlameGraphTooltip = ({ data, item, totalTicks, position, collapseConfig }: Props) => {
  const styles = useStyles2(getStyles);

  if (!(item && position)) {
    return null;
  }

  let content;

  if (data.isDiffFlamegraph()) {
    const tableData = getDiffTooltipData(data, item, totalTicks);
    content = (
      <InteractiveTable
        className={styles.tooltipTable}
        columns={[
          { id: 'label', header: '' },
          { id: 'baseline', header: 'Baseline' },
          { id: 'comparison', header: 'Comparison' },
          { id: 'diff', header: 'Diff' },
        ]}
        data={tableData}
        getRowId={(originalRow) => originalRow.rowId}
      />
    );
  } else {
    content = <ProfileTooltipDetails data={getTooltipData(data, item, totalTicks)} />;
  }

  return (
    <Portal>
      <VizTooltipContainer className={styles.tooltipContainer} position={position} offset={{ x: 15, y: 0 }}>
        <ProfileTooltipContent
          label={data.getLabel(item.itemIndexes[0])}
          collapsedCount={collapseConfig?.collapsed ? collapseConfig.items.length : undefined}
        >
          {content}
        </ProfileTooltipContent>
      </VizTooltipContainer>
    </Portal>
  );
};

export const getTooltipData = (
  data: FlameGraphDataContainer,
  item: LevelItem,
  totalTicks: number
): ProfileTooltipData => {
  return getProfileTooltipData({
    displayValue: data.valueDisplayProcessor(item.value),
    displaySelf: data.getSelfDisplay(item.itemIndexes),
    unitTitle: data.getUnitTitle(),
    totalTicks,
  });
};

type DiffTableData = {
  rowId: string;
  label: string;
  baseline: string | number;
  comparison: string | number;
  diff: string | number;
};

const formatWithSuffix = (value: number, formatter: ValueFormatter): string => {
  const displayValue = formatter(value);
  return displayValue.text + displayValue.suffix;
};

export const getDiffTooltipData = (
  data: FlameGraphDataContainer,
  item: LevelItem,
  totalTicks: number
): DiffTableData[] => {
  const levels = data.getLevels();
  const totalTicksRight = levels[0][0].valueRight!;
  const totalTicksLeft = totalTicks - totalTicksRight;
  // Guard against missing valueRight (e.g. a merged sandwich-view node) so we show 0 instead of NaN/undefined.
  const itemValueRight = item.valueRight ?? 0;
  const valueLeft = item.value - itemValueRight;

  const percentageLeft = Math.round((10000 * valueLeft) / totalTicksLeft) / 100;
  const percentageRight = Math.round((10000 * itemValueRight) / totalTicksRight) / 100;

  const diff = ((percentageRight - percentageLeft) / percentageLeft) * 100;

  const displayValueLeft = getValueWithUnit(data, data.valueDisplayProcessor(valueLeft));
  const displayValueRight = getValueWithUnit(data, data.valueDisplayProcessor(itemValueRight));

  const shortValFormat = getValueFormat('short');

  return [
    {
      rowId: '1',
      label: '% of total',
      baseline: percentageLeft + '%',
      comparison: percentageRight + '%',
      diff: formatWithSuffix(diff, shortValFormat) + '%',
    },
    {
      rowId: '2',
      label: 'Value',
      baseline: displayValueLeft,
      comparison: displayValueRight,
      diff: getValueWithUnit(data, data.valueDisplayProcessor(itemValueRight - valueLeft)),
    },
    {
      rowId: '3',
      label: 'Samples',
      baseline: formatWithSuffix(valueLeft, shortValFormat),
      comparison: formatWithSuffix(itemValueRight, shortValFormat),
      diff: formatWithSuffix(itemValueRight - valueLeft, shortValFormat),
    },
  ];
};

function getValueWithUnit(data: FlameGraphDataContainer, displayValue: DisplayValue) {
  let unitValue = displayValue.text + displayValue.suffix;

  const unitTitle = data.getUnitTitle();
  if (unitTitle === 'Count') {
    if (!displayValue.suffix) {
      // Makes sure we don't show 123undefined or something like that if suffix isn't defined
      unitValue = displayValue.text;
    }
  }
  return unitValue;
}

const getStyles = () => ({
  tooltipContainer: css({
    title: 'tooltipContainer',
    overflow: 'hidden',
  }),
  tooltipTable: css({
    title: 'tooltipTable',
    maxWidth: '400px',
  }),
});

export default FlameGraphTooltip;
