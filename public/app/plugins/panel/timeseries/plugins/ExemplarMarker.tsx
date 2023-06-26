import { css, cx } from '@emotion/css';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePopper } from 'react-popper';

import {
  DataFrame,
  DataFrameFieldIndex,
  dateTimeFormat,
  Field,
  FieldType,
  GrafanaTheme2,
  LinkModel,
  systemDateFormats,
  TimeZone,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { FieldLinkList, Portal, UPlotConfigBuilder, useStyles2 } from '@grafana/ui';

import { ExemplarModalHeader } from '../../heatmap/ExemplarModalHeader';

interface ExemplarMarkerProps {
  timeZone: TimeZone;
  dataFrame: DataFrame;
  dataFrameFieldIndex: DataFrameFieldIndex;
  config: UPlotConfigBuilder;
  getFieldLinks: (field: Field, rowIndex: number) => Array<LinkModel<Field>>;
  exemplarColor?: string;
  clickedExemplarFieldIndex: DataFrameFieldIndex | undefined;
  setClickedExemplarFieldIndex: React.Dispatch<DataFrameFieldIndex | undefined>;
}

export const ExemplarMarker = ({
  timeZone,
  dataFrame,
  dataFrameFieldIndex,
  config,
  getFieldLinks,
  exemplarColor,
  clickedExemplarFieldIndex,
  setClickedExemplarFieldIndex,
}: ExemplarMarkerProps) => {
  const styles = useStyles2(getExemplarMarkerStyles);
  const [isOpen, setIsOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [markerElement, setMarkerElement] = React.useState<HTMLDivElement | null>(null);
  const [popperElement, setPopperElement] = React.useState<HTMLDivElement | null>(null);
  const { styles: popperStyles, attributes } = usePopper(markerElement, popperElement, {
    modifiers: [
      {
        name: 'preventOverflow',
        options: {
          altAxis: true,
        },
      },
      {
        name: 'flip',
        options: {
          fallbackPlacements: ['top', 'left-start'],
        },
      },
    ],
  });
  const popoverRenderTimeout = useRef<NodeJS.Timer>();

  useEffect(() => {
    if (
      !(
        clickedExemplarFieldIndex?.fieldIndex === dataFrameFieldIndex.fieldIndex &&
        clickedExemplarFieldIndex?.frameIndex === dataFrameFieldIndex.frameIndex
      )
    ) {
      setIsLocked(false);
    }
  }, [clickedExemplarFieldIndex, dataFrameFieldIndex]);

  const getSymbol = () => {
    const symbols = [
      <rect
        fill={exemplarColor}
        key="diamond"
        x="3.38672"
        width="4.78985"
        height="4.78985"
        transform="rotate(45 3.38672 0)"
      />,
      <path
        fill={exemplarColor}
        key="x"
        d="M1.94444 3.49988L0 5.44432L1.55552 6.99984L3.49996 5.05539L5.4444 6.99983L6.99992 5.44431L5.05548 3.49988L6.99983 1.55552L5.44431 0L3.49996 1.94436L1.5556 0L8.42584e-05 1.55552L1.94444 3.49988Z"
      />,
      <path fill={exemplarColor} key="triangle" d="M4 0L7.4641 6H0.535898L4 0Z" />,
      <rect fill={exemplarColor} key="rectangle" width="5" height="5" />,
      <path
        fill={exemplarColor}
        key="pentagon"
        d="M3 0.5L5.85317 2.57295L4.76336 5.92705H1.23664L0.146831 2.57295L3 0.5Z"
      />,
      <path
        fill={exemplarColor}
        key="plus"
        d="m2.35672,4.2425l0,2.357l1.88558,0l0,-2.357l2.3572,0l0,-1.88558l-2.3572,0l0,-2.35692l-1.88558,0l0,2.35692l-2.35672,0l0,1.88558l2.35672,0z"
      />,
    ];

    return symbols[dataFrameFieldIndex.frameIndex % symbols.length];
  };

  const onMouseEnter = useCallback(() => {
    if (clickedExemplarFieldIndex === undefined) {
      if (popoverRenderTimeout.current) {
        clearTimeout(popoverRenderTimeout.current);
      }
      setIsOpen(true);
    }
  }, [setIsOpen, clickedExemplarFieldIndex]);

  const lockExemplarModal = () => {
    setIsLocked(true);
  };

  const onMouseLeave = useCallback(() => {
    popoverRenderTimeout.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  }, [setIsOpen]);

  const renderMarker = useCallback(() => {
    // Put the traceID field in front.
    const traceIDField = dataFrame.fields.find((field) => field.name === 'traceID') || dataFrame.fields[0];
    const orderedDataFrameFields = [traceIDField, ...dataFrame.fields.filter((field) => traceIDField !== field)];

    const timeFormatter = (value: number) => {
      return dateTimeFormat(value, {
        format: systemDateFormats.fullDate,
        timeZone,
      });
    };

    const onClose = () => {
      setIsLocked(false);
      setIsOpen(false);
      setClickedExemplarFieldIndex(undefined);
    };

    return (
      <div
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={styles.tooltip}
        ref={setPopperElement}
        style={popperStyles.popper}
        {...attributes.popper}
      >
        <div className={styles.wrapper}>
          {isLocked && <ExemplarModalHeader onClick={onClose} />}
          <div className={styles.body}>
            <div className={styles.header}>
              <span className={styles.title}>Exemplars</span>
            </div>
            <div>
              <table className={styles.exemplarsTable}>
                <tbody>
                  {orderedDataFrameFields.map((field, i) => {
                    const value = field.values[dataFrameFieldIndex.fieldIndex];
                    const links = field.config.links?.length
                      ? getFieldLinks(field, dataFrameFieldIndex.fieldIndex)
                      : undefined;
                    return (
                      <tr key={i}>
                        <td valign="top">{field.name}</td>
                        <td>
                          <div className={styles.valueWrapper}>
                            <span>{field.type === FieldType.time ? timeFormatter(value) : value}</span>
                            {links && <FieldLinkList links={links} />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }, [
    attributes.popper,
    dataFrame.fields,
    getFieldLinks,
    dataFrameFieldIndex,
    onMouseEnter,
    onMouseLeave,
    popperStyles.popper,
    styles,
    timeZone,
    isLocked,
    setClickedExemplarFieldIndex,
  ]);

  const seriesColor = config
    .getSeries()
    .find((s) => s.props.dataFrameFieldIndex?.frameIndex === dataFrameFieldIndex.frameIndex)?.props.lineColor;

  return (
    <>
      <div
        ref={setMarkerElement}
        onClick={() => {
          setClickedExemplarFieldIndex(dataFrameFieldIndex);
          lockExemplarModal();
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={styles.markerWrapper}
        aria-label={selectors.components.DataSource.Prometheus.exemplarMarker}
      >
        <svg
          viewBox="0 0 7 7"
          width="7"
          height="7"
          style={{ fill: seriesColor }}
          className={cx(styles.marble, (isOpen || isLocked) && styles.activeMarble)}
        >
          {getSymbol()}
        </svg>
      </div>
      {(isOpen || isLocked) && <Portal>{renderMarker()}</Portal>}
    </>
  );
};

const getExemplarMarkerStyles = (theme: GrafanaTheme2) => {
  const bg = theme.isDark ? theme.v1.palette.dark2 : theme.v1.palette.white;
  const headerBg = theme.isDark ? theme.v1.palette.dark9 : theme.v1.palette.gray5;
  const shadowColor = theme.isDark ? theme.v1.palette.black : theme.v1.palette.white;
  const tableBgOdd = theme.isDark ? theme.v1.palette.dark3 : theme.v1.palette.gray6;

  return {
    markerWrapper: css`
      padding: 0 4px 4px 4px;
      width: 8px;
      height: 8px;
      box-sizing: content-box;
      transform: translate3d(-50%, 0, 0);

      &:hover {
        > svg {
          transform: scale(1.3);
          opacity: 1;
          filter: drop-shadow(0 0 8px rgba(0, 0, 0, 0.5));
        }
      }
    `,
    marker: css`
      width: 0;
      height: 0;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-bottom: 4px solid ${theme.v1.palette.red};
      pointer-events: none;
    `,
    wrapper: css`
      background: ${bg};
      border: 1px solid ${headerBg};
      border-radius: ${theme.shape.borderRadius(2)};
      box-shadow: 0 0 20px ${shadowColor};
      padding: ${theme.spacing(1)};
    `,
    exemplarsTable: css`
      width: 100%;

      tr td {
        padding: 5px 10px;
        white-space: nowrap;
        border-bottom: 4px solid ${theme.components.panel.background};
      }

      tr {
        background-color: ${theme.colors.background.primary};

        &:nth-child(even) {
          background-color: ${tableBgOdd};
        }
      }
    `,
    valueWrapper: css`
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      column-gap: ${theme.spacing(1)};

      > span {
        flex-grow: 0;
      }

      > * {
        flex: 1 1;
        align-self: center;
      }
    `,
    tooltip: css`
      background: none;
      padding: 0;
      overflow-y: auto;
      max-height: 95vh;
    `,
    header: css`
      background: ${headerBg};
      padding: 6px 10px;
      display: flex;
    `,
    title: css`
      font-weight: ${theme.typography.fontWeightMedium};
      padding-right: ${theme.spacing(2)};
      overflow: hidden;
      display: inline-block;
      white-space: nowrap;
      text-overflow: ellipsis;
      flex-grow: 1;
    `,
    body: css`
      font-weight: ${theme.typography.fontWeightMedium};
      border-radius: ${theme.shape.borderRadius(2)};
      overflow: hidden;
    `,
    marble: css`
      display: block;
      opacity: 0.5;
      transition: transform 0.15s ease-out;
    `,
    activeMarble: css`
      transform: scale(1.3);
      opacity: 1;
      filter: drop-shadow(0 0 8px rgba(0, 0, 0, 0.5));
    `,
  };
};
