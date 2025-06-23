import { cx } from '@emotion/css';
import { isEqual } from 'lodash';
import { PureComponent, useEffect, useState } from 'react';
import * as React from 'react';

import {
  CoreApp,
  DataFrame,
  Field,
  IconName,
  LinkModel,
  LogLabelStatsModel,
  LogRowModel,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import {
  ClipboardButton,
  DataLinkButton,
  IconButton,
  PopoverContent,
  Tooltip,
} from '@grafana/ui';

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

interface State {
  showFieldsStats: boolean;
  fieldCount: number;
  fieldStats: LogLabelStatsModel[] | null;
}

export class LogDetailsRow extends PureComponent<Props, State> {
  state: State = {
    showFieldsStats: false,
    fieldCount: 0,
    fieldStats: null,
  };

  componentDidUpdate() {
    if (this.state.showFieldsStats) {
      this.updateStats();
    }
  }

  showField = () => {
    const { onClickShowField: onClickShowDetectedField, parsedKeys, row } = this.props;
    if (onClickShowDetectedField) {
      onClickShowDetectedField(parsedKeys[0]);
    }

    reportInteraction('grafana_explore_logs_log_details_replace_line_clicked', {
      datasourceType: row.datasourceType,
      logRowUid: row.uid,
      type: 'enable',
    });
  };

  hideField = () => {
    const { onClickHideField: onClickHideDetectedField, parsedKeys, row } = this.props;
    if (onClickHideDetectedField) {
      onClickHideDetectedField(parsedKeys[0]);
    }

    reportInteraction('grafana_explore_logs_log_details_replace_line_clicked', {
      datasourceType: row.datasourceType,
      logRowUid: row.uid,
      type: 'disable',
    });
  };

  isFilterLabelActive = async () => {
    const { isFilterLabelActive, parsedKeys, parsedValues, row } = this.props;
    if (isFilterLabelActive) {
      return await isFilterLabelActive(parsedKeys[0], parsedValues[0], row.dataFrame?.refId);
    }
    return false;
  };

  filterLabel = () => {
    const { onClickFilterLabel, parsedKeys, parsedValues, row } = this.props;
    if (onClickFilterLabel) {
      onClickFilterLabel(parsedKeys[0], parsedValues[0], logRowToSingleRowDataFrame(row) || undefined);
    }

    reportInteraction('grafana_explore_logs_log_details_filter_clicked', {
      datasourceType: row.datasourceType,
      filterType: 'include',
      logRowUid: row.uid,
    });
  };

  filterOutLabel = () => {
    const { onClickFilterOutLabel, parsedKeys, parsedValues, row } = this.props;
    if (onClickFilterOutLabel) {
      onClickFilterOutLabel(parsedKeys[0], parsedValues[0], logRowToSingleRowDataFrame(row) || undefined);
    }

    reportInteraction('grafana_explore_logs_log_details_filter_clicked', {
      datasourceType: row.datasourceType,
      filterType: 'exclude',
      logRowUid: row.uid,
    });
  };

  updateStats = () => {
    const { getStats } = this.props;
    const fieldStats = getStats();
    const fieldCount = fieldStats ? fieldStats.reduce((sum, stat) => sum + stat.count, 0) : 0;
    if (!isEqual(this.state.fieldStats, fieldStats) || fieldCount !== this.state.fieldCount) {
      this.setState({ fieldStats, fieldCount });
    }
  };

  showStats = () => {
    const { isLabel, row, app } = this.props;
    const { showFieldsStats } = this.state;
    if (!showFieldsStats) {
      this.updateStats();
    }
    this.toggleFieldsStats();

    reportInteraction('grafana_explore_logs_log_details_stats_clicked', {
      dataSourceType: row.datasourceType,
      fieldType: isLabel ? 'label' : 'detectedField',
      type: showFieldsStats ? 'close' : 'open',
      logRowUid: row.uid,
      app,
    });
  };

  toggleFieldsStats() {
    this.setState((state) => {
      return {
        showFieldsStats: !state.showFieldsStats,
      };
    });
  }

  generateClipboardButton(val: string) {
    const { theme } = this.props;
    const styles = getStyles(theme);

    return (
      <div className={`log-details-value-copy ${styles.copyButton}`}>
        <ClipboardButton
          getText={() => val}
          title={t('logs.un-themed-log-details-row.title-copy-value-to-clipboard', 'Copy value to clipboard')}
          fill="text"
          variant="secondary"
          icon="copy"
          size="md"
        />
      </div>
    );
  }

  generateMultiVal(value: string[], showCopy?: boolean) {
    return (
      <table>
        <tbody>
          {value?.map((val, i) => {
            return (
              <tr key={`${val}-${i}`}>
                <td>
                  {val}
                  {showCopy && val !== '' && this.generateClipboardButton(val)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  render() {
    const {
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
    } = this.props;
    const { showFieldsStats, fieldStats, fieldCount } = this.state;
    const singleKey = parsedKeys == null ? false : parsedKeys.length === 1;
    const singleVal = parsedValues == null ? false : parsedValues.length === 1;
    const hasFilteringFunctionality = !disableActions && onClickFilterLabel && onClickFilterOutLabel;
    const refIdTooltip = app === CoreApp.Explore && row.dataFrame?.refId ? ` in query ${row.dataFrame?.refId}` : '';
    const labelType = singleKey ? getLabelTypeFromRow(parsedKeys[0], row) : null;

    const isMultiParsedValueWithNoContent =
      !singleVal && parsedValues != null && !parsedValues.every((val) => val === '');

    const toggleFieldButton =
      displayedFields && parsedKeys != null && displayedFields.includes(parsedKeys[0]) ? (
        <IconButton
          variant="primary"
          tooltip={t('logs.un-themed-log-details-row.toggle-field-button.tooltip-hide-this-field', 'Hide this field')}
          name="eye"
          onClick={this.hideField}
        />
      ) : (
        <IconButton
          tooltip={t(
            'logs.un-themed-log-details-row.toggle-field-button.tooltip-field-instead-message',
            'Show this field instead of the message'
          )}
          name="eye"
          onClick={this.showField}
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
                    onClick={this.filterLabel}
                    // We purposely want to pass a new function on every render to allow the active state to be updated when log details remains open between updates.
                    isActive={() => this.isFilterLabelActive()}
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
                    onClick={this.filterOutLabel}
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
                  onClick={this.showStats}
                />
              )}
            </div>
          </td>

          <td>{labelType && <LabelTypeBadge type={labelType} styles={styles} />}</td>
          {/* Key - value columns */}
          <td className={styles.logDetailsLabel}>{singleKey ? parsedKeys[0] : this.generateMultiVal(parsedKeys)}</td>
          <td className={cx(styles.wordBreakAll, wrapLogMessage && styles.wrapLine)}>
            <div className={styles.logDetailsRowValue}>
              {singleVal ? parsedValues[0] : this.generateMultiVal(parsedValues, true)}
              {singleVal && this.generateClipboardButton(parsedValues[0])}
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
                onClick={this.showStats}
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
  }
}

function LabelTypeBadge({ type, styles }: { type: string; styles: ReturnType<typeof getStyles> }) {
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

