import { css } from '@emotion/css';

import { DisplayValue, getValueFormat, GrafanaTheme2, ValueFormatter } from '@grafana/data';
import { InteractiveTable, Portal, useStyles2, VizTooltipContainer } from '@grafana/ui';

import { CollapseConfig, FlameGraphDataContainer, LevelItem } from './dataTransform';

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
    const tooltipData = getTooltipData(data, item, totalTicks);
    content = (
      <p className={styles.lastParagraph}>
        {tooltipData.unitTitle}
        <br />
        Total: <b>{tooltipData.unitValue}</b> ({tooltipData.percentValue}%)
        <br />
        Self: <b>{tooltipData.unitSelf}</b> ({tooltipData.percentSelf}%)
        <br />
        Samples: <b>{tooltipData.samples}</b>
      </p>
    );
  }

  return (
    <Portal>
      <VizTooltipContainer className={styles.tooltipContainer} position={position} offset={{ x: 15, y: 0 }}>
        <div className={styles.tooltipContent}>
          <p className={styles.tooltipName}>
            {data.getLabel(item.itemIndexes[0])}
            {collapseConfig && collapseConfig.collapsed ? (
              <span>
                <br />
                and {collapseConfig.items.length} similar items
              </span>
            ) : (
              ''
            )}
          </p>
          {content}
        </div>
      </VizTooltipContainer>
    </Portal>
  );
};

type TooltipData = {
  percentValue: number;
  percentSelf: number;
  unitTitle: string;
  unitValue: string;
  unitSelf: string;
  samples: string;
};

export const getTooltipData = (data: FlameGraphDataContainer, item: LevelItem, totalTicks: number): TooltipData => {
  const displayValue = data.valueDisplayProcessor(item.value);
  const displaySelf = data.getSelfDisplay(item.itemIndexes);

  const percentValue = Math.round(10000 * (displayValue.numeric / totalTicks)) / 100;
  const percentSelf = Math.round(10000 * (displaySelf.numeric / totalTicks)) / 100;
  let unitValue = displayValue.text + displayValue.suffix;
  let unitSelf = displaySelf.text + displaySelf.suffix;

  const unitTitle = data.getUnitTitle();
  if (unitTitle === 'Count') {
    if (!displayValue.suffix) {
      // Makes sure we don't show 123undefined or something like that if suffix isn't defined
      unitValue = displayValue.text;
    }
    if (!displaySelf.suffix) {
      // Makes sure we don't show 123undefined or something like that if suffix isn't defined
      unitSelf = displaySelf.text;
    }
  }

  return {
    percentValue,
    percentSelf,
    unitTitle,
    unitValue,
    unitSelf,
    samples: displayValue.numeric.toLocaleString(),
  };
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
  const valueLeft = item.value - item.valueRight!;

  const percentageLeft = Math.round((10000 * valueLeft) / totalTicksLeft) / 100;
  const percentageRight = Math.round((10000 * item.valueRight!) / totalTicksRight) / 100;

  const diff = ((percentageRight - percentageLeft) / percentageLeft) * 100;

  const displayValueLeft = getValueWithUnit(data, data.valueDisplayProcessor(valueLeft));
  const displayValueRight = getValueWithUnit(data, data.valueDisplayProcessor(item.valueRight!));

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
      diff: getValueWithUnit(data, data.valueDisplayProcessor(item.valueRight! - valueLeft)),
    },
    {
      rowId: '3',
      label: 'Samples',
      baseline: formatWithSuffix(valueLeft, shortValFormat),
      comparison: formatWithSuffix(item.valueRight!, shortValFormat),
      diff: formatWithSuffix(item.valueRight! - valueLeft, shortValFormat),
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

const getStyles = (theme: GrafanaTheme2) => ({
  tooltipContainer: css({
    title: 'tooltipContainer',
    overflow: 'hidden',
  }),
  tooltipContent: css({
    title: 'tooltipContent',
    fontSize: theme.typography.bodySmall.fontSize,
    width: '100%',
  }),
  tooltipName: css({
    title: 'tooltipName',
    marginTop: 0,
    wordBreak: 'break-all',
  }),
  lastParagraph: css({
    title: 'lastParagraph',
    marginBottom: 0,
  }),
  name: css({
    title: 'name',
    marginBottom: '10px',
  }),

  tooltipTable: css({
    title: 'tooltipTable',
    maxWidth: '400px',
  }),
});

export default FlameGraphTooltip;
