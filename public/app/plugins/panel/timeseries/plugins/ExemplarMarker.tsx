import {
  DataFrame,
  dateTimeFormat,
  Field,
  FieldType,
  GrafanaTheme,
  LinkModel,
  systemDateFormats,
  TimeZone,
} from '@grafana/data';
import { FieldLinkList, Portal, TooltipContainer, useStyles } from '@grafana/ui';
import { css, cx } from 'emotion';
import React, { useCallback, useRef, useState } from 'react';

interface ExemplarMarkerProps {
  timeZone: TimeZone;
  dataFrame: DataFrame;
  index: number;
  getFieldLinks: (field: Field, rowIndex: number) => Array<LinkModel<Field>>;
}

export const ExemplarMarker: React.FC<ExemplarMarkerProps> = ({ timeZone, dataFrame, index, getFieldLinks }) => {
  const styles = useStyles(getExemplarMarkerStyles);
  const [isOpen, setIsOpen] = useState(false);
  const markerRef = useRef<HTMLDivElement>(null);
  const annotationPopoverRef = useRef<HTMLDivElement>(null);
  const popoverRenderTimeout = useRef<NodeJS.Timer>();

  const timeFormatter = useCallback(
    (value: number) => {
      return dateTimeFormat(value, {
        format: systemDateFormats.fullDate,
        timeZone,
      });
    },
    [timeZone]
  );

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
    if (!markerRef?.current) {
      return null;
    }

    const el = markerRef.current;
    const elBBox = el.getBoundingClientRect();

    return (
      <TooltipContainer
        position={{ x: elBBox.left, y: elBBox.top + elBBox.height }}
        offset={{ x: 0, y: 0 }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={styles.tooltip}
      >
        <div ref={annotationPopoverRef} className={styles.wrapper}>
          <div className={styles.header}>
            <span className={styles.title}>Exemplar</span>
          </div>
          <div className={styles.body}>
            <div>
              <table className={styles.exemplarsTable}>
                <tbody>
                  {dataFrame.fields.map((field, i) => {
                    const value = field.values.get(index);
                    const links = field.config.links?.length ? getFieldLinks(field, index) : undefined;
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
      </TooltipContainer>
    );
  }, [dataFrame.fields, getFieldLinks, index, onMouseEnter, onMouseLeave, styles, timeFormatter]);

  return (
    <>
      <div ref={markerRef} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} className={styles.markerWrapper}>
        <svg viewBox="0 0 599 599" width="8" height="8" className={cx(styles.marble, isOpen && styles.activeMarble)}>
          <path d="M 300,575 L 575,300 L 300,25 L 25,300 L 300,575 Z" />
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
  const marbleFill = theme.isDark ? theme.palette.gray3 : theme.palette.gray1;
  const marbleFillHover = theme.isDark ? theme.palette.blue85 : theme.palette.blue77;
  const tableBgOdd = theme.isDark ? theme.palette.dark3 : theme.palette.gray6;

  const marble = css`
    display: block;
    fill: ${marbleFill};
    transition: transform 0.15s ease-out;
  `;
  const activeMarble = css`
    fill: ${marbleFillHover};
    transform: scale(1.3);
    filter: drop-shadow(0 0 8px rgba(0, 0, 0, 0.5));
  `;

  return {
    markerWrapper: css`
      padding: 0 4px 4px 4px;
      width: 8px;
      height: 8px;
      box-sizing: content-box;

      &:hover {
        > svg {
          ${activeMarble}
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
    marble,
    activeMarble,
  };
};
