import { css } from '@emotion/css';
import { isEqual } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as React from 'react';

import { CoreApp, Field, fuzzySearch, GrafanaTheme2, IconName, LinkModel, LogLabelStatsModel } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { ClipboardButton, DataLinkButton, IconButton, useStyles2 } from '@grafana/ui';

import { logRowToSingleRowDataFrame } from '../../logsModel';
import { calculateLogsLabelStats, calculateStats } from '../../utils';
import { LogLabelStats } from '../LogLabelStats';
import { FieldDef } from '../logParser';

import { useLogListContext } from './LogListContext';
import { LogListModel } from './processing';

interface LogLineDetailsFieldsProps {
  fields: FieldDef[];
  log: LogListModel;
  logs: LogListModel[];
  search?: string;
}

export const LogLineDetailsFields = ({ fields, log, logs, search }: LogLineDetailsFieldsProps) => {
  if (!fields.length) {
    return null;
  }
  const styles = useStyles2(getFieldsStyles);
  const getLogs = useCallback(() => logs, [logs]);
  const filteredFields = useMemo(() => (search ? filterFields(fields, search) : fields), [fields, search]);

  return (
    <div className={styles.fieldsTable}>
      {filteredFields.map((field, i) => (
        <LogLineDetailsField
          key={`${field.keys[0]}=${field.values[0]}-${i}`}
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
};

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

export const LogLineDetailsLabelFields = ({ fields, log, logs, search }: LogLineDetailsLabelFieldsProps) => {
  if (!fields.length) {
    return null;
  }
  const styles = useStyles2(getFieldsStyles);
  const getLogs = useCallback(() => logs, [logs]);
  const filteredFields = useMemo(() => (search ? filterLabels(fields, search) : fields), [fields, search]);

  if (filteredFields.length === 0) {
    return t('logs.log-line-details.search.no-results', 'No results to display.');
  }

  return (
    <div className={styles.fieldsTable}>
      {filteredFields.map((field, i) => (
        <LogLineDetailsField
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

const getFieldsStyles = (theme: GrafanaTheme2) => ({
  fieldsTable: css({
    display: 'grid',
    gap: theme.spacing(1),
    gridTemplateColumns: `${theme.spacing(11.5)} minmax(20%, 30%) 1fr`,
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

export const LogLineDetailsField = ({
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
  const {
    app,
    closeDetails,
    displayedFields,
    isLabelFilterActive,
    onClickFilterLabel,
    onClickFilterOutLabel,
    onClickShowField,
    onClickHideField,
    onPinLine,
    pinLineButtonTooltipTitle,
  } = useLogListContext();

  const styles = useStyles2(getFieldStyles);

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

  const showField = useCallback(() => {
    if (onClickShowField) {
      onClickShowField(keys[0]);
    }

    reportInteraction('grafana_explore_logs_log_details_replace_line_clicked', {
      datasourceType: log.datasourceType,
      logRowUid: log.uid,
      type: 'enable',
    });
  }, [onClickShowField, keys, log.datasourceType, log.uid]);

  const hideField = useCallback(() => {
    if (onClickHideField) {
      onClickHideField(keys[0]);
    }

    reportInteraction('grafana_explore_logs_log_details_replace_line_clicked', {
      datasourceType: log.datasourceType,
      logRowUid: log.uid,
      type: 'disable',
    });
  }, [onClickHideField, keys, log.datasourceType, log.uid]);

  const filterLabel = useCallback(() => {
    if (onClickFilterLabel) {
      onClickFilterLabel(keys[0], values[0], logRowToSingleRowDataFrame(log) || undefined);
    }

    reportInteraction('grafana_explore_logs_log_details_filter_clicked', {
      datasourceType: log.datasourceType,
      filterType: 'include',
      logRowUid: log.uid,
    });
  }, [onClickFilterLabel, keys, values, log]);

  const filterOutLabel = useCallback(() => {
    if (onClickFilterOutLabel) {
      onClickFilterOutLabel(keys[0], values[0], logRowToSingleRowDataFrame(log) || undefined);
    }

    reportInteraction('grafana_explore_logs_log_details_filter_clicked', {
      datasourceType: log.datasourceType,
      filterType: 'exclude',
      logRowUid: log.uid,
    });
  }, [onClickFilterOutLabel, keys, values, log]);

  const labelFilterActive = useCallback(async () => {
    if (isLabelFilterActive) {
      return await isLabelFilterActive(keys[0], values[0], log.dataFrame?.refId);
    }
    return false;
  }, [isLabelFilterActive, keys, values, log.dataFrame?.refId]);

  const showStats = useCallback(() => {
    setShowFieldStats((showFieldStats: boolean) => !showFieldStats);

    reportInteraction('grafana_explore_logs_log_details_stats_clicked', {
      dataSourceType: log.datasourceType,
      fieldType: isLabel ? 'label' : 'detectedField',
      type: showFieldsStats ? 'close' : 'open',
      logRowUid: log.uid,
      app,
    });
  }, [app, isLabel, log.datasourceType, log.uid, showFieldsStats]);

  const refIdTooltip = useMemo(
    () => (app === CoreApp.Explore && log.dataFrame?.refId ? ` in query ${log.dataFrame?.refId}` : ''),
    [app, log.dataFrame?.refId]
  );
  const singleKey = keys.length === 1;
  const singleValue = values.length === 1;

  return (
    <>
      <div className={styles.row}>
        {!disableActions && (
          <div className={styles.actions}>
            {onClickFilterLabel && (
              <AsyncIconButton
                name="search-plus"
                onClick={filterLabel}
                // We purposely want to pass a new function on every render to allow the active state to be updated when log details remains open between updates.
                isActive={labelFilterActive}
                tooltipSuffix={refIdTooltip}
              />
            )}
            {onClickFilterOutLabel && (
              <IconButton
                name="search-minus"
                tooltip={
                  app === CoreApp.Explore && log.dataFrame?.refId
                    ? t('logs.log-details.fields.filter-out-query', 'Filter out value in query {{query}}', {
                        query: log.dataFrame?.refId,
                      })
                    : t('logs.log-details.fields.filter-out', 'Filter out value')
                }
                onClick={filterOutLabel}
              />
            )}
            {singleKey && displayedFields.includes(keys[0]) && (
              <IconButton
                variant="primary"
                tooltip={t('logs.log-details.fields.toggle-field-button.hide-this-field', 'Hide this field')}
                name="eye"
                onClick={hideField}
              />
            )}
            {singleKey && !displayedFields.includes(keys[0]) && (
              <IconButton
                tooltip={t(
                  'logs.log-details.fields.toggle-field-button.field-instead-message',
                  'Show this field instead of the message'
                )}
                name="eye"
                onClick={showField}
              />
            )}
            <IconButton
              variant={showFieldsStats ? 'primary' : 'secondary'}
              name="signal"
              tooltip={t('logs.log-details.fields.adhoc-statistics', 'Ad-hoc statistics')}
              className="stats-button"
              disabled={!singleKey}
              onClick={showStats}
            />
          </div>
        )}
        <div className={styles.label}>{singleKey ? keys[0] : <MultipleValue values={keys} />}</div>
        <div className={styles.value}>
          <div className={styles.valueContainer}>
            {singleValue ? values[0] : <MultipleValue showCopy={true} values={values} />}
            {singleValue && <ClipboardButtonWrapper value={values[0]} />}
          </div>
        </div>
      </div>
      {links?.map((link, i) => {
        if (link.onClick && onPinLine) {
          const originalOnClick = link.onClick;
          link.onClick = (e, origin) => {
            // Pin the line
            onPinLine(log);

            // Execute the link onClick function
            originalOnClick(e, origin);

            closeDetails();
          };
        }
        return (
          <tr>
            <td colSpan={2}></td>
            <td>
              <div>
                <div>
                  <div key={`${link.title}-${i}`} className={styles.link}>
                    <DataLinkButton
                      buttonProps={{
                        // Show tooltip message if max number of pinned lines has been reached
                        tooltip:
                          typeof pinLineButtonTooltipTitle === 'object' && link.onClick
                            ? pinLineButtonTooltipTitle
                            : undefined,
                        variant: 'secondary',
                        fill: 'outline',
                        ...(link.icon && { icon: link.icon }),
                      }}
                      link={link}
                    />
                  </div>
                </div>
              </div>
            </td>
          </tr>
        );
      })}
      {showFieldsStats && fieldStats && (
        <tr>
          <td>
            <IconButton
              variant={showFieldsStats ? 'primary' : 'secondary'}
              name="signal"
              tooltip={t('logs.log-details.fields.hide-adhoc-statistics', 'Hide ad-hoc statistics')}
              onClick={showStats}
            />
          </td>
          <td colSpan={3}>
            <LogLabelStats
              stats={fieldStats}
              label={keys[0]}
              value={values[0]}
              rowCount={fieldCount}
              isLabel={isLabel}
            />
          </td>
        </tr>
      )}
    </>
  );
};

const getFieldStyles = (theme: GrafanaTheme2) => ({
  row: css({
    display: 'contents',
  }),
  actions: css({
    whiteSpace: 'nowrap',
  }),
  label: css({
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
  }),
  value: css({
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
    button: {
      visibility: 'hidden',
    },
    '&:hover': {
      button: {
        visibility: 'visible',
      },
    },
  }),
  link: css({}),
  valueContainer: css({
    display: 'flex',
    alignItems: 'center',
    lineHeight: theme.typography.body.lineHeight,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  }),
});

const ClipboardButtonWrapper = ({ value }: { value: string }) => {
  const styles = useStyles2(getClipboardButtonStyles);
  return (
    <div className={styles.button}>
      <ClipboardButton
        getText={() => value}
        title={t('logs.log-details.fields.copy-value-to-clipboard', 'Copy value to clipboard')}
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

const MultipleValue = ({ showCopy, values = [] }: { showCopy?: boolean; values: string[] }) => {
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
              <td>{showCopy && val !== '' && <ClipboardButtonWrapper value={val} />}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

interface AsyncIconButtonProps extends Pick<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  name: IconName;
  isActive(): Promise<boolean>;
  tooltipSuffix: string;
}

const AsyncIconButton = ({ isActive, tooltipSuffix, ...rest }: AsyncIconButtonProps) => {
  const [active, setActive] = useState(false);
  const tooltip = active ? 'Remove filter' : 'Filter for value';

  useEffect(() => {
    isActive().then(setActive);
  }, [isActive]);

  return <IconButton {...rest} variant={active ? 'primary' : undefined} tooltip={tooltip + tooltipSuffix} />;
};

function filterFields(fields: FieldDef[], search: string) {
  const keys = fields.map((field) => field.keys.join(' '));
  const keysIdx = fuzzySearch(keys, search);
  const values = fields.map((field) => field.values.join(' '));
  const valuesIdx = fuzzySearch(values, search);

  const results = keysIdx.map((index) => fields[index]);
  valuesIdx.forEach((index) => {
    if (!results.includes(fields[index])) {
      results.push(fields[index]);
    }
  });

  return results;
}

function filterLabels(labels: LabelWithLinks[], search: string) {
  const keys = labels.map((field) => field.key);
  const keysIdx = fuzzySearch(keys, search);
  const values = labels.map((field) => field.value);
  const valuesIdx = fuzzySearch(values, search);

  const results = keysIdx.map((index) => labels[index]);
  valuesIdx.forEach((index) => {
    if (!results.includes(labels[index])) {
      results.push(labels[index]);
    }
  });

  return results;
}
