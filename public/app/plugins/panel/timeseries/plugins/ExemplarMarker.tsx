import { css, cx } from '@emotion/css';
import {
  DataFrame,
  DataFrameFieldIndex,
  dateTimeFormat,
  Field,
  FieldType,
  GrafanaTheme,
  LinkModel,
  systemDateFormats,
  TimeZone,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { FieldLinkList, Portal, UPlotConfigBuilder, useStyles } from '@grafana/ui';
import React, { useCallback, useRef, useState } from 'react';
import { usePopper } from 'react-popper';

interface ExemplarMarkerProps {
  timeZone: TimeZone;
  dataFrame: DataFrame;
  dataFrameFieldIndex: DataFrameFieldIndex;
  config: UPlotConfigBuilder;
  getFieldLinks: (field: Field, rowIndex: number) => Array<LinkModel<Field>>;
}

export const ExemplarMarker: React.FC<ExemplarMarkerProps> = ({
  timeZone,
  dataFrame,
  dataFrameFieldIndex,
  config,
  getFieldLinks,
}) => {
  const styles = useStyles(getExemplarMarkerStyles);
  const [isOpen, setIsOpen] = useState(false);
  const [markerElement, setMarkerElement] = React.useState<HTMLDivElement | null>(null);
  const [popperElement, setPopperElement] = React.useState<HTMLDivElement | null>(null);
  const { styles: popperStyles, attributes } = usePopper(markerElement, popperElement);
  const popoverRenderTimeout = useRef<NodeJS.Timer>();

  const getSymbol = () => {
    const symbols = [
      <rect key="diamond" x="3.38672" width="4.78985" height="4.78985" transform="rotate(45 3.38672 0)" />,
      <path
        key="x"
        d="M1.94444 3.49988L0 5.44432L1.55552 6.99984L3.49996 5.05539L5.4444 6.99983L6.99992 5.44431L5.05548 3.49988L6.99983 1.55552L5.44431 0L3.49996 1.94436L1.5556 0L8.42584e-05 1.55552L1.94444 3.49988Z"
      />,
      <path key="triangle" d="M4 0L7.4641 6H0.535898L4 0Z" />,
      <rect key="rectangle" width="5" height="5" />,
      <path key="pentagon" d="M3 0.5L5.85317 2.57295L4.76336 5.92705H1.23664L0.146831 2.57295L3 0.5Z" />,
      <path
        key="plus"
        d="m2.35672,4.2425l0,2.357l1.88558,0l0,-2.357l2.3572,0l0,-1.88558l-2.3572,0l0,-2.35692l-1.88558,0l0,2.35692l-2.35672,0l0,1.88558l2.35672,0z"
      />,
    ];
    return symbols[dataFrameFieldIndex.frameIndex % symbols.length];
  };

  const onMouseEnter = useCallback(() => {
    if (popoverRenderTimeout.current) {
      clearTimeout(popoverRenderTimeout.current);
    }
    setIsOpen(true);
  }, [setIsOpen]);

  const onMouseLeave = useCallback(() => {
    popoverRenderTimeout.current = setTimeout(() => {
      setIsOpen(false);
    }, 100);
  }, [setIsOpen]);

  const renderMarker = useCallback(() => {
    const timeFormatter = (value: number) => {
      return dateTimeFormat(value, {
        format: systemDateFormats.fullDate,
        timeZone,
      });
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
          <div className={styles.header}>
            <span className={styles.title}>Exemplar</span>
          </div>
          <div className={styles.body}>
            <div>
              <table className={styles.exemplarsTable}>
                <tbody>
                  {dataFrame.fields.map((field, i) => {
                    const value = field.values.get(dataFrameFieldIndex.fieldIndex);
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
  ]);

  const seriesColor = config
    .getSeries()
    .find((s) => s.props.dataFrameFieldIndex?.frameIndex === dataFrameFieldIndex.frameIndex)?.props.lineColor;

  return (
    <>
      <div
        ref={setMarkerElement}
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
          className={cx(styles.marble, isOpen && styles.activeMarble)}
        >
          {getSymbol()}
        </svg>
      </div>
      {isOpen && <Portal>{renderMarker()}</Portal>}
    </>
  );
};

const getExemplarMarkerStyles = (theme: GrafanaTheme) => {
  const bg = theme.isDark ? theme.palette.dark2 : theme.palette.white;
  const headerBg = theme.isDark ? theme.palette.dark9 : theme.palette.gray5;
  const shadowColor = theme.isDark ? theme.palette.black : theme.palette.white;
  const tableBgOdd = theme.isDark ? theme.palette.dark3 : theme.palette.gray6;

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
      border-bottom: 4px solid ${theme.palette.red};
      pointer-events: none;
    `,
    wrapper: css`
      background: ${bg};
      border: 1px solid ${headerBg};
      border-radius: ${theme.border.radius.md};
      box-shadow: 0 0 20px ${shadowColor};
    `,
    exemplarsTable: css`
      width: 100%;

      tr td {
        padding: 5px 10px;
        white-space: nowrap;
        border-bottom: 4px solid ${theme.colors.panelBg};
      }

      tr {
        background-color: ${theme.colors.bg1};
        &:nth-child(even) {
          background-color: ${tableBgOdd};
        }
      }
    `,
    valueWrapper: css`
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      column-gap: ${theme.spacing.sm};

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
    `,
    header: css`
      background: ${headerBg};
      padding: 6px 10px;
      display: flex;
    `,
    title: css`
      font-weight: ${theme.typography.weight.semibold};
      padding-right: ${theme.spacing.md};
      overflow: hidden;
      display: inline-block;
      white-space: nowrap;
      text-overflow: ellipsis;
      flex-grow: 1;
    `,
    body: css`
      padding: ${theme.spacing.sm};
      font-weight: ${theme.typography.weight.semibold};
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
