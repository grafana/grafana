import { css, cx } from '@emotion/css';
import { useMemo } from 'react';

import {
  CoreApp,
  DataFrame,
  DataFrameType,
  GrafanaTheme2,
  IconName,
  LinkModel,
  LogRowModel,
  PluginExtensionPoints,
  PluginExtensionResourceAttributesContext,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { usePluginLinks } from '@grafana/runtime';
import { PopoverContent, styleMixins, useStyles2 } from '@grafana/ui';
import { GetFieldLinksFn } from 'app/plugins/panel/logs/types';

import { calculateLogsLabelStats, calculateStats } from '../../utils';
import { getAllFields, createLogLineLinks } from '../logParser';

import { LogDetailsBody } from './LogDetailsBody';
import { LogDetailsRow } from './LogDetailsRow';

export interface Props {
  row: LogRowModel;
  showDuplicates: boolean;
  getRows: () => LogRowModel[];
  wrapLogMessage: boolean;
  className?: string;
  hasError?: boolean;
  app?: CoreApp;

  onClickFilterLabel?: (key: string, value: string, frame?: DataFrame) => void;
  onClickFilterOutLabel?: (key: string, value: string, frame?: DataFrame) => void;
  getFieldLinks?: GetFieldLinksFn;
  displayedFields?: string[];
  onClickShowField?: (key: string) => void;
  onClickHideField?: (key: string) => void;
  isFilterLabelActive?: (key: string, value: string, refId?: string) => Promise<boolean>;

  onPinLine?: (row: LogRowModel) => void;
  pinLineButtonTooltipTitle?: PopoverContent;
  links?: Record<string, LinkModel[]>;
}

interface LinkModelWithIcon extends LinkModel {
  icon?: IconName;
}

const useAttributesExtensionLinks = (row: LogRowModel) => {
  // Stable context for useMemo inside usePluginLinks
  const context: PluginExtensionResourceAttributesContext = useMemo(() => {
    return {
      attributes: Object.fromEntries(Object.entries(row.labels).map(([key, value]) => [key, [value]])),
      datasource: {
        type: row.datasourceType ?? '',
        uid: row.datasourceUid ?? '',
      },
    };
  }, [row.labels, row.datasourceType, row.datasourceUid]);

  const { links } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.LogsViewResourceAttributes,
    limitPerPlugin: 10,
    context,
  });

  return useMemo(() => {
    return links.reduce<Record<string, LinkModelWithIcon[]>>((acc, link) => {
      if (link.category) {
        const linkModel: LinkModelWithIcon = {
          href: link.path ?? '',
          target: '_blank',
          origin: undefined,
          title: link.title,
          onClick: link.onClick,
          icon: link.icon,
        };

        if (acc[link.category]) {
          acc[link.category].push(linkModel);
        } else {
          acc[link.category] = [linkModel];
        }
      }
      return acc;
    }, {});
  }, [links]);
};

export const LogDetails = ({
  app,
  row,
  onClickFilterOutLabel,
  onClickFilterLabel,
  getRows,
  className,
  onClickShowField,
  onClickHideField,
  displayedFields,
  getFieldLinks,
  wrapLogMessage,
  onPinLine,
  pinLineButtonTooltipTitle,
  isFilterLabelActive,
}: Props) => {
  const links = useAttributesExtensionLinks(row);
  const styles = useStyles2(getStyles);
  const labels = row.labels ? row.labels : {};
  const labelsAvailable = Object.keys(labels).length > 0;
  const fieldsAndLinks = getAllFields(row, getFieldLinks);
  let fieldsWithLinks = fieldsAndLinks.filter((f) => f.links?.length);
  const displayedFieldsWithLinks = fieldsWithLinks.filter((f) => f.fieldIndex !== row.entryFieldIndex).sort();
  const hiddenFieldsWithLinks = fieldsWithLinks.filter((f) => f.fieldIndex === row.entryFieldIndex).sort();
  const fieldsWithLinksFromVariableMap = createLogLineLinks(hiddenFieldsWithLinks);
  const fieldsWithLinksAvailable =
    (displayedFieldsWithLinks && displayedFieldsWithLinks.length > 0) ||
    (fieldsWithLinksFromVariableMap && fieldsWithLinksFromVariableMap.length > 0);

  const fields =
    row.dataFrame.meta?.type === DataFrameType.LogLines
      ? // for LogLines frames (dataplane) we don't want to show any additional fields besides already extracted labels and links
        []
      : // for other frames, do not show the log message unless there is a link attached
        fieldsAndLinks.filter((f) => f.links?.length === 0 && f.fieldIndex !== row.entryFieldIndex).sort();
  const fieldsAvailable = fields && fields.length > 0;

  return (
    <tr className={cx(className, styles.logDetails)}>
      <td>
        <div className={styles.logDetailsSidebarContainer}>
          <table className={styles.logDetailsTable}>
            <tbody>
              {displayedFields && displayedFields.length > 0 && (
                <>
                  <tr>
                    <td
                      className={styles.logDetailsHeading}
                      aria-label={t('logs.un-themed-log-details.aria-label-line', 'Log line')}
                    >
                      <Trans i18nKey="logs.log-details.log-line">Log line</Trans>
                    </td>
                  </tr>
                  <LogDetailsBody
                    onClickShowField={onClickShowField}
                    onClickHideField={onClickHideField}
                    row={row}
                    app={app}
                    displayedFields={displayedFields}
                    disableActions={false}
                    styles={styles}
                  />
                </>
              )}
              {(labelsAvailable || fieldsAvailable) && (
                <tr>
                  <td
                    colSpan={100}
                    className={styles.logDetailsHeading}
                    aria-label={t('logs.un-themed-log-details.aria-label-fields', 'Fields')}
                  >
                    <Trans i18nKey="logs.log-details.fields">Fields</Trans>
                  </td>
                </tr>
              )}
              {Object.keys(labels)
                .sort()
                .map((key, i) => {
                  const value = labels[key];
                  return (
                    <LogDetailsRow
                      key={`${key}=${value}-${i}`}
                      parsedKeys={[key]}
                      parsedValues={[value]}
                      isLabel={true}
                      getStats={() => calculateLogsLabelStats(getRows(), key)}
                      onClickFilterOutLabel={onClickFilterOutLabel}
                      onClickFilterLabel={onClickFilterLabel}
                      onClickShowField={onClickShowField}
                      onClickHideField={onClickHideField}
                      row={row}
                      app={app}
                      wrapLogMessage={wrapLogMessage}
                      displayedFields={displayedFields}
                      disableActions={false}
                      isFilterLabelActive={isFilterLabelActive}
                      links={links?.[key]}
                      styles={styles}
                    />
                  );
                })}
              {fields.map((field, i) => {
                const { keys, values, fieldIndex } = field;
                return (
                  <LogDetailsRow
                    key={`${keys[0]}=${values[0]}-${i}`}
                    parsedKeys={keys}
                    parsedValues={values}
                    onClickShowField={onClickShowField}
                    onClickHideField={onClickHideField}
                    onClickFilterOutLabel={onClickFilterOutLabel}
                    onClickFilterLabel={onClickFilterLabel}
                    getStats={() => calculateStats(row.dataFrame.fields[fieldIndex].values)}
                    displayedFields={displayedFields}
                    wrapLogMessage={wrapLogMessage}
                    row={row}
                    app={app}
                    disableActions={false}
                    isFilterLabelActive={isFilterLabelActive}
                    styles={styles}
                  />
                );
              })}

              {fieldsWithLinksAvailable && (
                <tr>
                  <td
                    colSpan={100}
                    className={styles.logDetailsHeading}
                    aria-label={t('logs.un-themed-log-details.aria-label-data-links', 'Data links')}
                  >
                    <Trans i18nKey="logs.log-details.links">Links</Trans>
                  </td>
                </tr>
              )}
              {displayedFieldsWithLinks.map((field, i) => {
                const { keys, values, links, fieldIndex } = field;
                return (
                  <LogDetailsRow
                    key={`${keys[0]}=${values[0]}-${i}`}
                    parsedKeys={keys}
                    parsedValues={values}
                    links={links}
                    onClickShowField={onClickShowField}
                    onClickHideField={onClickHideField}
                    onPinLine={onPinLine}
                    pinLineButtonTooltipTitle={pinLineButtonTooltipTitle}
                    getStats={() => calculateStats(row.dataFrame.fields[fieldIndex].values)}
                    displayedFields={displayedFields}
                    wrapLogMessage={wrapLogMessage}
                    row={row}
                    app={app}
                    disableActions={false}
                    styles={styles}
                  />
                );
              })}
              {fieldsWithLinksFromVariableMap?.map((field, i) => {
                const { keys, values, links, fieldIndex } = field;
                return (
                  <LogDetailsRow
                    key={`${keys[0]}=${values[0]}-${i}`}
                    parsedKeys={keys}
                    parsedValues={values}
                    links={links}
                    onClickShowField={onClickShowField}
                    onClickHideField={onClickHideField}
                    onPinLine={onPinLine}
                    pinLineButtonTooltipTitle={pinLineButtonTooltipTitle}
                    getStats={() => calculateStats(row.dataFrame.fields[fieldIndex].values)}
                    displayedFields={displayedFields}
                    wrapLogMessage={wrapLogMessage}
                    row={row}
                    app={app}
                    disableActions={true}
                    styles={styles}
                  />
                );
              })}

              {!fieldsAvailable && !labelsAvailable && !fieldsWithLinksAvailable && (
                <tr>
                  <td colSpan={100} aria-label={t('logs.un-themed-log-details.aria-label-no-details', 'No details')}>
                    <Trans i18nKey="logs.log-details.no-details">No details available</Trans>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
};

export type LogDetailsStyles = ReturnType<typeof getStyles>;
const getStyles = (theme: GrafanaTheme2) => {
  const hoverBgColor = styleMixins.hoverColor(theme.colors.background.secondary, theme);
  return {
    // LogDetails
    logDetails: css({
      label: 'logDetailsDefaultCursor',
      cursor: 'default',

      '&:hover': {
        backgroundColor: theme.colors.background.primary,
      },
    }),
    logDetailsSidebarContainer: css({
      label: 'logs-row-details-table',
      border: `1px solid ${theme.colors.border.medium}`,
      padding: theme.spacing(0, 1, 1),
      borderRadius: theme.shape.radius.default,
      margin: theme.spacing(0, 1, 0, 1),
      cursor: 'default',
    }),
    logDetailsTable: css({
      label: 'logs-row-details-table',
      lineHeight: '18px',
      width: '100%',
      'td:last-child': {
        width: '100%',
      },
    }),
    logDetailsHeading: css({
      label: 'logs-row-details__heading',
      fontWeight: theme.typography.fontWeightBold,
      padding: theme.spacing(1, 0, 0.5),
    }),

    // LogDetailsBody
    bodyButtonRow: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(0.5),
      marginLeft: theme.spacing(0.5),
    }),

    // LogDetailsRow
    labelType: css({
      border: `solid 1px ${theme.colors.text.secondary}`,
      color: theme.colors.text.secondary,
      borderRadius: theme.shape.radius.circle,
      fontSize: theme.spacing(1),
      lineHeight: theme.spacing(1.25),
      height: theme.spacing(1.5),
      width: theme.spacing(1.5),
      display: 'flex',
      justifyContent: 'center',
      verticalAlign: 'middle',
      marginLeft: theme.spacing(1),
    }),
    wordBreakAll: css({
      label: 'wordBreakAll',
      wordBreak: 'break-all',
    }),
    copyButton: css({
      '& > button': {
        color: theme.colors.text.secondary,
        padding: 0,
        justifyContent: 'center',
        borderRadius: theme.shape.radius.circle,
        height: theme.spacing(theme.components.height.sm),
        width: theme.spacing(theme.components.height.sm),
        svg: {
          margin: 0,
        },

        'span > div': {
          top: '-5px',
          '& button': {
            color: theme.colors.success.main,
          },
        },
      },
    }),
    adjoiningLinkButton: css({
      marginLeft: theme.spacing(1),
    }),
    wrapLine: css({
      label: 'wrapLine',
      whiteSpace: 'pre-wrap',
    }),
    logDetailsStats: css({
      padding: `0 ${theme.spacing(1)}`,
    }),
    logDetailsRowValue: css({
      display: 'flex',
      alignItems: 'center',
      lineHeight: '22px',

      '.log-details-value-copy': {
        visibility: 'hidden',
      },
      '&:hover': {
        '.log-details-value-copy': {
          visibility: 'visible',
        },
      },
    }),
    buttonRow: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(0.5),
      marginLeft: theme.spacing(0.5),
    }),
    logDetailsValue: css({
      label: 'logs-row-details__row',
      position: 'relative',
      verticalAlign: 'middle',
      cursor: 'default',

      '&:hover': {
        backgroundColor: hoverBgColor,
      },
    }),
    logsDetailsIcon: css({
      label: 'logs-row-details__icon',
      position: 'relative',
      color: theme.v1.palette.gray3,
      paddingTop: '1px',
      paddingBottom: '1px',
      paddingRight: theme.spacing(0.75),
    }),
    logDetailsLabel: css({
      label: 'logs-row-details__label',
      maxWidth: '30em',
      padding: theme.spacing(0, 1),
      overflowWrap: 'break-word',
    }),
  };
};
