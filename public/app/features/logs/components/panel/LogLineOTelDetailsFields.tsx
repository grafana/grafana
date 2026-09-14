import { css } from '@emotion/css';
import { isEqual } from 'lodash';
import { parse, stringify } from 'lossless-json';
import { memo, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import {
  CoreApp,
  type Field,
  type GrafanaTheme2,
  type IconName,
  type LinkModel,
  type LogLabelStatsModel,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { ClipboardButton, Icon, IconButton, useStyles2 } from '@grafana/ui';

import { logRowToSingleRowDataFrame } from '../../logsModel';
import { calculateLogsLabelStats, calculateStats } from '../../utils';
import { LogLabelStats } from '../LogLabelStats';
import { OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME } from '../fieldSelector/logFields';
import { type FieldDef } from '../logParser';

import { AsyncIconButton } from './AsyncIconButton';
import { useLogDetailsContext } from './LogDetailsContext';
import { filterFields, filterLabels } from './LogLineDetailsFields';
import { type LogListFontSize } from './LogList';
import { useLogListContext } from './LogListContext';
import { type LogListModel, getNormalizedFieldName } from './processing';

interface LogLineDetailsFieldsProps {
  disableActions?: boolean;
  fields: FieldDef[];
  log: LogListModel;
  logs: LogListModel[];
  search?: string;
}

export const LogLineOTelDetailsFields = memo(({ disableActions, fields, log, logs, search }: LogLineDetailsFieldsProps) => {
  const { fontSize } = useLogListContext();
  const styles = useStyles2(getFieldsStyles, fontSize);
  const getLogs = useCallback(() => logs, [logs]);
  const filteredFields = useMemo(() => (search ? filterFields(fields, search) : fields), [fields, search]);

  if (!fields.length) {
    return null;
  } else if (filteredFields.length === 0) {
    return t('logs.log-line-details.search.no-results', 'No results to display.');
  }

  return (
    <div className={disableActions ? styles.fieldsTableNoActions : styles.fieldsTable}>
      {filteredFields.map((field, i) => (
        <LogLineOTelDetailsField
          key={`${field.keys[0]}=${field.values[0]}-${i}`}
          disableActions={disableActions}
          getLogs={getLogs}
          fieldIndex={field.fieldIndex}
          keys={field.keys}
          links={field.links}
          log={log}
          values={field.values}
        />
      ))}
    </div>
  );
});
LogLineOTelDetailsFields.displayName = 'LogLineOTelDetailsFields';

interface LinkModelWithIcon extends LinkModel<Field> {
  icon?: IconName;
}

export interface LabelWithLinks {
  key: string;
  value: string;
  links?: LinkModelWithIcon[];
}

interface LogLineDetailsLabelFieldsProps {
  fields: LabelWithLinks[];
  log: LogListModel;
  logs: LogListModel[];
  search?: string;
}

export const LogLineOTelDetailsLabelFields = ({ fields, log, logs, search }: LogLineDetailsLabelFieldsProps) => {
  const { fontSize } = useLogListContext();
  const styles = useStyles2(getFieldsStyles, fontSize);
  const getLogs = useCallback(() => logs, [logs]);
  const filteredFields = useMemo(() => (search ? filterLabels(fields, search) : fields), [fields, search]);

  if (!fields.length) {
    return null;
  } else if (filteredFields.length === 0) {
    return t('logs.log-line-details.search.no-results', 'No results to display.');
  }

  return (
    <div className={styles.fieldsTable}>
      {filteredFields.map((field, i) => (
        <LogLineOTelDetailsField
          key={`${field.key}=${field.value}-${i}`}
          getLogs={getLogs}
          isLabel
          keys={[field.key]}
          links={field.links}
          log={log}
          values={[field.value]}
        />
      ))}
    </div>
  );
};

const getFieldsStyles = (
  theme: GrafanaTheme2,
  fontSize: LogListFontSize,
) => ({
  fieldsTable: css({
    display: 'grid',
    gap: fontSize === 'small' ? theme.spacing(0.25, 0.5) : theme.spacing(0.5, 1),
    gridTemplateColumns: `fit-content(30%) 1fr`,
  }),
  fieldsTableNoActions: css({
    display: 'grid',
    gap: fontSize === 'small' ? theme.spacing(0.25, 0.5) : theme.spacing(0.5, 1),
    gridTemplateColumns: `auto 1fr`,
  }),
});

interface LogLineDetailsFieldProps {
  keys: string[];
  values: string[];
  disableActions?: boolean;
  fieldIndex?: number;
  getLogs(): LogListModel[];
  isLabel?: boolean;
  links?: LinkModelWithIcon[];
  log: LogListModel;
}

const LogLineOTelDetailsField = ({
  disableActions = false,
  fieldIndex,
  getLogs,
  isLabel,
  links,
  log,
  keys,
  values,
}: LogLineDetailsFieldProps) => {
  const [showFieldsStats, setShowFieldStats] = useState(false);
  const [fieldCount, setFieldCount] = useState(0);
  const [fieldStats, setFieldStats] = useState<LogLabelStatsModel[] | null>(null);
  const { fontSize } = useLogListContext();
  const {
    app,
    displayedFields,
    isLabelFilterActive,
    noInteractions,
    onClickFilterLabel,
    onClickFilterOutLabel,
    onClickShowField,
    onClickHideField,
    onPinLine,
    pinLineButtonTooltipTitle,
    prettifyJSON,
  } = useLogListContext();
  const { closeDetails } = useLogDetailsContext();

  const styles = useStyles2(getFieldStyles, fontSize);

  const getStats = useCallback(() => {
    if (isLabel) {
      return calculateLogsLabelStats(getLogs(), keys[0]);
    }
    if (fieldIndex !== undefined) {
      return calculateStats(log.dataFrame.fields[fieldIndex].values);
    }
    return [];
  }, [fieldIndex, getLogs, isLabel, keys, log.dataFrame.fields]);

  const updateStats = useCallback(() => {
    const newStats = getStats();
    const newCount = newStats.reduce((sum, stat) => sum + stat.count, 0);
    if (!isEqual(fieldStats, newStats) || fieldCount !== newCount) {
      setFieldStats(newStats);
      setFieldCount(newCount);
    }
  }, [fieldCount, fieldStats, getStats]);

  useEffect(() => {
    if (showFieldsStats) {
      updateStats();
    }
  }, [showFieldsStats, updateStats]);

  const reportInteractionWrapper = useCallback(
    (interactionName: string, properties?: Record<string, unknown>) => {
      if (noInteractions) {
        return;
      }
      reportInteraction(interactionName, properties);
    },
    [noInteractions]
  );

  const showField = useCallback(() => {
    if (onClickShowField) {
      onClickShowField(keys[0]);
    }

    reportInteractionWrapper('logs_log_line_details_show_field_clicked', {
      datasourceType: log.datasourceType,
    });
  }, [onClickShowField, reportInteractionWrapper, log.datasourceType, keys]);

  const hideField = useCallback(() => {
    if (onClickHideField) {
      onClickHideField(keys[0]);
    }

    reportInteractionWrapper('logs_log_line_details_hide_field_clicked', {
      datasourceType: log.datasourceType,
    });
  }, [onClickHideField, reportInteractionWrapper, log.datasourceType, keys]);

  const filterLabel = useCallback(() => {
    if (onClickFilterLabel) {
      onClickFilterLabel(keys[0], values[0], logRowToSingleRowDataFrame(log) || undefined);
    }

    reportInteractionWrapper('logs_log_line_details_filter_clicked', {
      datasourceType: log.datasourceType,
      filterType: 'include',
      logRowUid: log.uid,
    });
  }, [onClickFilterLabel, reportInteractionWrapper, log, keys, values]);

  const filterOutLabel = useCallback(() => {
    if (onClickFilterOutLabel) {
      onClickFilterOutLabel(keys[0], values[0], logRowToSingleRowDataFrame(log) || undefined);
    }

    reportInteractionWrapper('logs_log_line_details_filter_clicked', {
      datasourceType: log.datasourceType,
      filterType: 'exclude',
      logRowUid: log.uid,
    });
  }, [onClickFilterOutLabel, reportInteractionWrapper, log, keys, values]);

  const includeAdhocValue = useCallback(
    (value: string) => {
      onClickFilterLabel?.(keys[0], value, logRowToSingleRowDataFrame(log) || undefined);

      reportInteractionWrapper('logs_log_line_details_filter_clicked', {
        datasourceType: log.datasourceType,
        filterType: 'include',
        logRowUid: log.uid,
      });
    },
    [onClickFilterLabel, reportInteractionWrapper, log, keys]
  );

  const excludeAdhocValue = useCallback(
    (value: string) => {
      onClickFilterOutLabel?.(keys[0], value, logRowToSingleRowDataFrame(log) || undefined);

      reportInteractionWrapper('logs_log_line_details_filter_clicked', {
        datasourceType: log.datasourceType,
        filterType: 'exclude',
        logRowUid: log.uid,
      });
    },
    [onClickFilterOutLabel, reportInteractionWrapper, log, keys]
  );

  const labelFilterActive = useCallback(
    async (value?: string) => {
      if (isLabelFilterActive) {
        return await isLabelFilterActive(keys[0], value ?? values[0], log.dataFrame?.refId);
      }
      return false;
    },
    [isLabelFilterActive, keys, values, log.dataFrame?.refId]
  );

  const showStats = useCallback(() => {
    setShowFieldStats((showFieldStats: boolean) => !showFieldStats);

    reportInteractionWrapper('logs_log_line_details_stats_clicked', {
      dataSourceType: log.datasourceType,
      fieldType: isLabel ? 'label' : 'field',
      type: showFieldsStats ? 'close' : 'open',
      logRowUid: log.uid,
      app,
    });
  }, [app, isLabel, log.datasourceType, log.uid, reportInteractionWrapper, showFieldsStats]);

  const reportLinkClick = useCallback(
    (link: LinkModelWithIcon) => {
      reportInteractionWrapper('logs_log_line_details_extension_link_clicked', {
        app,
        linkApp: resolveAppFromLink(link.href),
        fieldKey: keys[0],
        fieldType: isLabel ? 'label' : 'field',
        datasourceType: log.datasourceType,
        logLevel: log.logLevel,
      });
    },
    [app, isLabel, keys, log.datasourceType, log.logLevel, reportInteractionWrapper]
  );

  const refIdTooltip = useMemo(
    () => (app === CoreApp.Explore && log.dataFrame?.refId ? ` in query ${log.dataFrame?.refId}` : ''),
    [app, log.dataFrame?.refId]
  );
  const singleKey = keys.length === 1;
  const singleValue = values.length === 1;

  const fieldSupportsFilters = keys[0] !== OTEL_LOG_LINE_ATTRIBUTES_FIELD_NAME;

  return (
    <>
      <div className={styles.row}>
        <div className={styles.label}>
          {singleKey ? getNormalizedFieldName(keys[0]) : <MultipleValue values={keys} />}
        </div>
        <div className={styles.value}>
          <div className={styles.valueContainer}>
            <div className={styles.valueContent}>
              {singleValue ? (
                <SingleValue value={values[0]} links={links} prettifyJSON={prettifyJSON} />
              ) : (
                <MultipleValue values={values} links={links} />
              )}
            </div>
            {!disableActions && (
              <div className={styles.actions}>
                <div className={styles.actionIcons}>
                  {onClickFilterLabel && fieldSupportsFilters && (
                    <AsyncIconButton
                      name="search-plus"
                      size={fontSize === 'small' ? 'sm' : undefined}
                      onClick={filterLabel}
                      // We purposely want to pass a new function on every render to allow the active state to be updated when log details remains open between updates.
                      isActive={labelFilterActive}
                      tooltipSuffix={refIdTooltip}
                    />
                  )}
                  {onClickFilterOutLabel && fieldSupportsFilters && (
                    <IconButton
                      name="search-minus"
                      size={fontSize === 'small' ? 'sm' : undefined}
                      tooltip={
                        app === CoreApp.Explore && log.dataFrame?.refId
                          ? t('logs.log-line-details.fields.filter-out-query', 'Filter out value in query {{query}}', {
                            query: log.dataFrame?.refId,
                          })
                          : t('logs.log-line-details.fields.filter-out', 'Filter out value')
                      }
                      onClick={filterOutLabel}
                    />
                  )}
                  <IconButton
                    variant={showFieldsStats ? 'primary' : 'secondary'}
                    name="signal"
                    size={fontSize === 'small' ? 'sm' : undefined}
                    tooltip={t('logs.log-line-details.fields.adhoc-statistics', 'Ad-hoc statistics')}
                    className={styles.statsIcon}
                    disabled={!singleKey}
                    onClick={showStats}
                  />
                  <ClipboardButtonWrapper value={values[0]} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {showFieldsStats && fieldStats && (
        <div className={styles.row}>
          <div className={disableActions ? undefined : styles.statsColumn}>
            <LogLabelStats
              include={includeAdhocValue}
              exclude={excludeAdhocValue}
              isValueActive={labelFilterActive}
              iconSize={fontSize === 'small' ? 'sm' : undefined}
              className={styles.stats}
              stats={fieldStats}
              label={keys[0]}
              value={values[0]}
              rowCount={fieldCount}
              isLabel={isLabel}
            />
          </div>
        </div>
      )}
    </>
  );
};

export function resolveAppFromLink(href: string): string | undefined {
  return href.match(/\/a\/([^/?#]+)/)?.[1];
}

const getFieldStyles = (theme: GrafanaTheme2, fontSize: LogListFontSize) => {
  const actions = css({
    position: 'absolute',
    top: 0,
    right: 0,
    background: theme.colors.background.primary,
    whiteSpace: 'nowrap',
    visibility: 'hidden',
  });

  return {
    row: css({
      display: 'contents',
      position: 'relative',
    }),
    actions,
    actionIcons: css({
      display: 'flex',
      justifyContent: 'flex-end',
      paddingRight: 2,
    }),
    statsIcon: css({
      margin: 0,
      paddingRight: 4,
    }),
    label: css({
      color: theme.colors.text.secondary,
      paddingRight: theme.spacing(1),
      overflowWrap: 'break-word',
      wordBreak: 'break-word',
    }),
    value: css({
      position: 'relative',
      minWidth: 0,
      overflowWrap: 'break-word',
      wordBreak: 'break-word',
      [`&:hover .${actions}, &:focus-within .${actions}`]: {
        visibility: 'visible',
      },
    }),
    link: css({
      gridColumn: '2 / 4',
    }),
    linkNoActions: css({
      gridColumn: 'span 2',
      paddingBottom: theme.spacing(0.5),
    }),
    stats: css({
      paddingRight: theme.spacing(1),
      wordBreak: 'break-all',
      width: '100%',
      maxWidth: '50vh',
    }),
    statsColumn: css({
      gridColumn: '2 / 4',
    }),
    valueContainer: css({
      display: 'flex',
      alignItems: 'flex-start',
      width: '100%',
      lineHeight: theme.typography.body.lineHeight,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      maxHeight: '50vh',
      overflow: 'auto',
    }),
    valueContent: css({
      flex: 1,
      minWidth: 0,
    }),
  };
};

const ClipboardButtonWrapper = ({ value }: { value: string }) => {
  const styles = useStyles2(getClipboardButtonStyles);
  return (
    <div className={styles.button}>
      <ClipboardButton
        getText={() => value}
        aria-label={t('logs.log-line-details.fields.copy-value-to-clipboard', 'Copy value to clipboard')}
        fill="text"
        variant="secondary"
        icon="copy"
        size="md"
      />
    </div>
  );
};

const getClipboardButtonStyles = (theme: GrafanaTheme2) => ({
  button: css({
    '& > button': {
      color: theme.colors.text.secondary,
      gap: 0,
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
});

export const MultipleValue = ({ values = [] }: { values: string[] }) => {
  if (values.every((val) => val === '')) {
    return null;
  }
  return (
    <table>
      <tbody>
        {values.map((val, i) => {
          return (
            <tr key={`${val}-${i}`}>
              <td>{val}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export const SingleValue = ({ links, value: originalValue, prettifyJSON }: { links?: LinkModelWithIcon[]; value: string; prettifyJSON?: boolean }) => {
  const value = useMemo(() => {
    if (!prettifyJSON) {
      return originalValue;
    }
    try {
      const parsed = stringify(parse(originalValue), undefined, 2);
      if (parsed) {
        return parsed;
      }
    } catch (error) { }
    return originalValue;
  }, [originalValue, prettifyJSON]);

  if (links?.length === 1) {
    return <Link link={links[0]}>{value}</Link>
  }

  return value;
};

const Link = ({ children, link }: { children: ReactNode; link: LinkModelWithIcon }) => {
  const icon: IconName | undefined = link.icon ?? (link.target === '_blank' ? 'external-link-alt' : undefined);

  return (
    <>
      {icon && <Icon name={icon} />}
      <a
        href={link.href}
        target={link.target}
        rel="noreferrer"
        onClick={
          link.onClick
            ? (event) => {
              if (!(event.ctrlKey || event.metaKey || event.shiftKey) && link.onClick) {
                event.preventDefault();
                link.onClick(event);
              }
            }
            : undefined
        }
      >
        {children}
      </a>
    </>
  )
}
