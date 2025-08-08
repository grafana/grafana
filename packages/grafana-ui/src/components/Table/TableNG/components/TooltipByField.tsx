import { css } from '@emotion/css';
import { clsx } from 'clsx';
import { CSSProperties, ReactElement, cloneElement, useMemo, useRef } from 'react';

import { ActionModel, DataFrame, Field, GrafanaTheme2 } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../../../themes/ThemeContext';
import { Popover } from '../../../Tooltip/Popover';
import { PopoverController } from '../../../Tooltip/PopoverController';
import { TableCellOptions } from '../../types';
import { TABLE } from '../constants';
import { TableCellRenderer, TableCellRendererProps } from '../types';

export interface Props {
  cellOptions: TableCellOptions;
  children: ReactElement;
  className?: string;
  data: DataFrame;
  disableSanitizeHtml?: boolean;
  field: Field;
  getActions: (field: Field, rowIdx: number) => ActionModel[];
  height?: number;
  renderer: TableCellRenderer;
  rowIdx: number;
  style?: CSSProperties;
  width?: number;
}

export function TooltipByField({
  cellOptions,
  children,
  className,
  data,
  disableSanitizeHtml,
  field,
  getActions,
  height: _height,
  renderer,
  rowIdx,
  style,
  width = 300,
}: Props) {
  const popoverRef = useRef<HTMLElement | null>(null);
  const rawValue = field.values[rowIdx];
  const height = _height ?? TABLE.MAX_CELL_HEIGHT;
  const wrapperClass = useStyles2(getStyles, width, height);
  const theme = useTheme2();
  const rendererProps = useMemo(
    () =>
      ({
        cellInspect: false,
        cellOptions,
        disableSanitizeHtml,
        field,
        frame: data,
        getActions,
        height,
        rowIdx,
        showFilters: false,
        theme,
        value: rawValue,
        width,
      }) satisfies TableCellRendererProps,
    [cellOptions, data, disableSanitizeHtml, field, getActions, height, rawValue, rowIdx, theme, width]
  );

  if (rawValue === null || rawValue === undefined) {
    return children;
  }

  return (
    <PopoverController content={<>{renderer(rendererProps)}</>} placement="right">
      {(showPopper, hidePopper, popperProps) => (
        <>
          {popoverRef.current && (
            <Popover
              {...popperProps}
              wrapperClassName={clsx(className, wrapperClass)}
              style={style}
              referenceElement={popoverRef.current}
              onMouseLeave={hidePopper}
              onMouseEnter={showPopper}
            />
          )}
          {cloneElement(children, {
            ref: popoverRef,
            key: null,
            onMouseEnter: showPopper,
            onMouseLeave: hidePopper,
          })}
        </>
      )}
    </PopoverController>
  );
}

const getStyles = (theme: GrafanaTheme2, width: number, height: number) =>
  css({
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    overflow: 'hidden',
    padding: theme.spacing(1),
    height,
    width,
  });
