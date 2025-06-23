import { cx } from '@emotion/css';
import { isEqual } from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import * as React from 'react';

import { CoreApp, DataFrame, Field, IconName, LinkModel, LogLabelStatsModel, LogRowModel } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { ClipboardButton, DataLinkButton, IconButton, PopoverContent, Tooltip } from '@grafana/ui';

import { logRowToSingleRowDataFrame } from '../../logsModel';
import { getLabelTypeFromRow } from '../../utils';
import { LogLabelStats } from '../LogLabelStats';

import { LogDetailsStyles } from './LogDetails';

interface LinkModelWithIcon extends LinkModel<Field> {
  icon?: IconName;
}

export interface Props {
  parsedValues: string[];
  parsedKeys: string[];
  disableActions: boolean;
  wrapLogMessage?: boolean;
  isLabel?: boolean;
  onClickFilterLabel?: (key: string, value: string, frame?: DataFrame) => void;
  onClickFilterOutLabel?: (key: string, value: string, frame?: DataFrame) => void;
  links?: LinkModelWithIcon[];
  getStats: () => LogLabelStatsModel[] | null;
  displayedFields?: string[];
  onClickShowField?: (key: string) => void;
  onClickHideField?: (key: string) => void;
  row: LogRowModel;
  app?: CoreApp;
  isFilterLabelActive?: (key: string, value: string, refId?: string) => Promise<boolean>;
  onPinLine?: (row: LogRowModel, allowUnPin?: boolean) => void;
  pinLineButtonTooltipTitle?: PopoverContent;
  styles: LogDetailsStyles;
}

export const LogDetailsRow = ({
  parsedKeys,
  parsedValues,
  isLabel,
  links,
  displayedFields,
  wrapLogMessage,
  onClickFilterLabel,
  onClickFilterOutLabel,
  disableActions,
  row,
  app,
  onPinLine,
  pinLineButtonTooltipTitle,
  styles,
  getStats,
  onClickShowField,
  onClickHideField,
  isFilterLabelActive,
}: Props) => {
  const [showFieldsStats, setShowFieldStats] = useState(false);
  const [fieldCount, setFieldCount] = useState(0);
  const [fieldStats, setFieldStats] = useState<LogLabelStatsModel[] | null>(null);

  const updateStats = useCallback(() => {
    const fieldStats = getStats();
    const fieldCount = fieldStats ? fieldStats.reduce((sum, stat) => sum + stat.count, 0) : 0;
    if (!isEqual(fieldStats, fieldStats) || fieldCount !== fieldCount) {
      setFieldStats(fieldStats);
      setFieldCount(fieldCount);
    }
  }, [getStats]);

  useEffect(() => {
    if (showFieldsStats) {
      updateStats();
    }
  }, [showFieldsStats, updateStats]);

  const singleKey = parsedKeys == null ? false : parsedKeys.length === 1;
  const singleVal = parsedValues == null ? false : parsedValues.length === 1;
  const hasFilteringFunctionality = !disableActions && onClickFilterLabel && onClickFilterOutLabel;
  const refIdTooltip = app === CoreApp.Explore && row.dataFrame?.refId ? ` in query ${row.dataFrame?.refId}` : '';
  const labelType = singleKey ? getLabelTypeFromRow(parsedKeys[0], row) : null;

  const isMultiParsedValueWithNoContent =
    !singleVal && parsedValues != null && !parsedValues.every((val) => val === '');

  const showField = useCallback(() => {
    if (onClickShowField) {
      onClickShowField(parsedKeys[0]);
    }

    reportInteraction('grafana_explore_logs_log_details_replace_line_clicked', {
      datasourceType: row.datasourceType,
      logRowUid: row.uid,
      type: 'enable',
    });
  }, [onClickShowField, parsedKeys, row.datasourceType, row.uid]);

  const hideField = useCallback(() => {
    if (onClickHideField) {
      onClickHideField(parsedKeys[0]);
    }

    reportInteraction('grafana_explore_logs_log_details_replace_line_clicked', {
      datasourceType: row.datasourceType,
      logRowUid: row.uid,
      type: 'disable',
    });
  }, [onClickHideField, parsedKeys, row.datasourceType, row.uid]);

  const filterLabel = useCallback(() => {
    if (onClickFilterLabel) {
      onClickFilterLabel(parsedKeys[0], parsedValues[0], logRowToSingleRowDataFrame(row) || undefined);
    }

    reportInteraction('grafana_explore_logs_log_details_filter_clicked', {
      datasourceType: row.datasourceType,
      filterType: 'include',
      logRowUid: row.uid,
    });
  }, [onClickFilterLabel, parsedKeys, parsedValues, row]);

  const filterOutLabel = useCallback(() => {
    if (onClickFilterOutLabel) {
      onClickFilterOutLabel(parsedKeys[0], parsedValues[0], logRowToSingleRowDataFrame(row) || undefined);
    }

    reportInteraction('grafana_explore_logs_log_details_filter_clicked', {
      datasourceType: row.datasourceType,
      filterType: 'exclude',
      logRowUid: row.uid,
    });
  }, [onClickFilterOutLabel, parsedKeys, parsedValues, row]);

  const isLabelFilterActive = useCallback(async () => {
    if (isFilterLabelActive) {
      return await isFilterLabelActive(parsedKeys[0], parsedValues[0], row.dataFrame?.refId);
    }
    return false;
  }, [isFilterLabelActive, parsedKeys, parsedValues, row.dataFrame?.refId]);

  const showStats = useCallback(() => {
    if (!showFieldsStats) {
      updateStats();
    }
    setShowFieldStats((showFieldStats: boolean) => !showFieldStats);

    reportInteraction('grafana_explore_logs_log_details_stats_clicked', {
      dataSourceType: row.datasourceType,
      fieldType: isLabel ? 'label' : 'detectedField',
      type: showFieldsStats ? 'close' : 'open',
      logRowUid: row.uid,
      app,
    });
  }, [app, isLabel, row.datasourceType, row.uid, showFieldsStats, updateStats]);

  const toggleFieldButton =
    displayedFields && parsedKeys != null && displayedFields.includes(parsedKeys[0]) ? (
      <IconButton
        variant="primary"
        tooltip={t('logs.un-themed-log-details-row.toggle-field-button.tooltip-hide-this-field', 'Hide this field')}
        name="eye"
        onClick={hideField}
      />
    ) : (
      <IconButton
        tooltip={t(
          'logs.un-themed-log-details-row.toggle-field-button.tooltip-field-instead-message',
          'Show this field instead of the message'
        )}
        name="eye"
        onClick={showField}
      />
    );

  return (
    <>
      <tr className={styles.logDetailsValue}>
        <td className={styles.logsDetailsIcon}>
          <div className={styles.buttonRow}>
            {hasFilteringFunctionality && (
              <>
                <AsyncIconButton
                  name="search-plus"
                  onClick={filterLabel}
                  // We purposely want to pass a new function on every render to allow the active state to be updated when log details remains open between updates.
                  isActive={isLabelFilterActive}
                  tooltipSuffix={refIdTooltip}
                />
                <IconButton
                  name="search-minus"
                  tooltip={
                    app === CoreApp.Explore && row.dataFrame?.refId
                      ? t('logs.un-themed-log-details-row.filter-out-query', 'Filter out value in query {{query}}', {
                          query: row.dataFrame?.refId,
                        })
                      : t('logs.un-themed-log-details-row.filter-out', 'Filter out value')
                  }
                  onClick={filterOutLabel}
                />
              </>
            )}
            {!disableActions && displayedFields && toggleFieldButton}
            {!disableActions && (
              <IconButton
                variant={showFieldsStats ? 'primary' : 'secondary'}
                name="signal"
                tooltip={t('logs.un-themed-log-details-row.tooltip-adhoc-statistics', 'Ad-hoc statistics')}
                className="stats-button"
                disabled={!singleKey}
                onClick={showStats}
              />
            )}
          </div>
        </td>

        <td>{labelType && <LabelTypeBadge type={labelType} styles={styles} />}</td>
        {/* Key - value columns */}
        <td className={styles.logDetailsLabel}>
          {singleKey ? parsedKeys[0] : <MultipleValue values={parsedKeys} styles={styles} />}
        </td>
        <td className={cx(styles.wordBreakAll, wrapLogMessage && styles.wrapLine)}>
          <div className={styles.logDetailsRowValue}>
            {singleVal ? parsedValues[0] : <MultipleValue showCopy={true} styles={styles} values={parsedValues} />}
            {singleVal && <ClipboardButtonWrapper styles={styles} value={parsedValues[0]} />}
            <div className={cx((singleVal || isMultiParsedValueWithNoContent) && styles.adjoiningLinkButton)}>
              {links?.map((link, i) => {
                if (link.onClick && onPinLine) {
                  const originalOnClick = link.onClick;
                  link.onClick = (e, origin) => {
                    // Pin the line
                    onPinLine(row, false);

                    // Execute the link onClick function
                    originalOnClick(e, origin);
                  };
                }
                return (
                  <span key={`${link.title}-${i}`}>
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
                  </span>
                );
              })}
            </div>
          </div>
        </td>
      </tr>
      {showFieldsStats && singleKey && singleVal && (
        <tr>
          <td colSpan={2}>
            <IconButton
              variant={showFieldsStats ? 'primary' : 'secondary'}
              name="signal"
              tooltip={t('logs.un-themed-log-details-row.tooltip-hide-adhoc-statistics', 'Hide ad-hoc statistics')}
              onClick={showStats}
            />
          </td>
          <td colSpan={2}>
            <div className={styles.logDetailsStats}>
              <LogLabelStats
                stats={fieldStats!}
                label={parsedKeys[0]}
                value={parsedValues[0]}
                rowCount={fieldCount}
                isLabel={isLabel}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

const ClipboardButtonWrapper = ({ styles, value }: { styles: LogDetailsStyles; value: string }) => {
  return (
    <div className={`log-details-value-copy ${styles.copyButton}`}>
      <ClipboardButton
        getText={() => value}
        title={t('logs.un-themed-log-details-row.title-copy-value-to-clipboard', 'Copy value to clipboard')}
        fill="text"
        variant="secondary"
        icon="copy"
        size="md"
      />
    </div>
  );
};

const MultipleValue = ({
  showCopy,
  styles,
  values = [],
}: {
  showCopy?: boolean;
  styles: LogDetailsStyles;
  values: string[];
}) => {
  return (
    <table>
      <tbody>
        {values.map((val, i) => {
          return (
            <tr key={`${val}-${i}`}>
              <td>
                {val}
                {showCopy && val !== '' && <ClipboardButtonWrapper styles={styles} value={val} />}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

function LabelTypeBadge({ type, styles }: { type: string; styles: LogDetailsStyles }) {
  return (
    <Tooltip content={type}>
      <div className={styles.labelType}>
        <span>{type.substring(0, 1)}</span>
      </div>
    </Tooltip>
  );
}

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
