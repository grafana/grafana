import { css } from '@emotion/css';
import { ReactNode, useLayoutEffect, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { TableCellDisplayMode } from '@grafana/schema';

import { useStyles2 } from '../../../../themes';
import { IconButton } from '../../../IconButton/IconButton';
import { getTextAlign } from '../../utils';

import AutoCell from './AutoCell';
import { BarGaugeCell } from './BarGaugeCell';
import { SparklineCell } from './SparklineCell';

// interface TableCellNGProps {
//     fieldConfig: FieldConfig;
//     fieldDisplay: any?
// }

export function TableCellNG(props: any) {
  const {
    field,
    value,
    theme,
    timeRange,
    height,
    rowIdx,
    justifyContent,
    shouldTextOverflow,
    setIsInspecting,
    setContextMenuProps,
    cellInspect,
  } = props;
  const { config: fieldConfig } = field;
  const { type: cellType } = fieldConfig.custom.cellOptions;

  const isRightAligned = getTextAlign(field) === 'flex-end';
  const styles = useStyles2(getStyles, isRightAligned);

  // TODO
  // TableNG provides either an overridden cell width or 'auto' as the cell width value.
  // While the overridden value gives the exact cell width, 'auto' does not.
  // Therefore, we need to determine the actual cell width from the DOM.
  const divWidthRef = useRef<HTMLDivElement>(null);
  const [divWidth, setDivWidth] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useLayoutEffect(() => {
    if (divWidthRef.current && divWidthRef.current.clientWidth !== 0) {
      setDivWidth(divWidthRef.current.clientWidth);
    }
  }, [divWidthRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get the correct cell type
  let cell: ReactNode = null;
  switch (cellType) {
    // case TableCellDisplayMode.
    case TableCellDisplayMode.Sparkline:
      cell = (
        <SparklineCell
          value={value}
          field={field}
          theme={theme}
          timeRange={timeRange}
          height={height}
          width={divWidth}
          rowIdx={rowIdx}
          justifyContent={justifyContent}
        />
      );
      break;
    case TableCellDisplayMode.Gauge:
    case TableCellDisplayMode.BasicGauge:
    case TableCellDisplayMode.GradientGauge:
    case TableCellDisplayMode.LcdGauge:
      cell = (
        <BarGaugeCell
          value={value}
          field={field}
          theme={theme}
          justifyContent={justifyContent}
          timeRange={timeRange}
          height={height}
          width={divWidth}
        />
      );
      break;
    case TableCellDisplayMode.Auto:
    default:
      cell = (
        <AutoCell
          value={value}
          field={field}
          theme={theme}
          justifyContent={justifyContent}
          shouldTextOverflow={shouldTextOverflow}
          setIsHovered={setIsHovered}
        />
      );
  }

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <div ref={divWidthRef} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {cell}
      {cellInspect && isHovered && (
        <div className={styles.cellActions}>
          <IconButton
            name="eye"
            tooltip="Inspect value"
            onClick={() => {
              setContextMenuProps({ value });
              setIsInspecting(true);
            }}
          />
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, isRightAligned: boolean) => ({
  cellActions: css({
    display: 'flex',
    position: 'absolute',
    top: '1px',
    left: isRightAligned ? 0 : undefined,
    right: isRightAligned ? undefined : 0,
    margin: 'auto',
    height: '100%',
    background: theme.colors.background.secondary,
    color: theme.colors.text.primary,
    padding: '4px 0px 4px 4px',
  }),
});
