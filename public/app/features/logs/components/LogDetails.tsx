import { cx } from '@emotion/css';
import { PureComponent, useMemo } from 'react';

import {
  CoreApp,
  DataFrame,
  DataFrameType,
  IconName,
  LinkModel,
  LogRowModel,
  PluginExtensionPoints,
  PluginExtensionResourceAttributesContext,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { usePluginLinks } from '@grafana/runtime';
import { PopoverContent, Themeable2, withTheme2 } from '@grafana/ui';
import { GetFieldLinksFn } from 'app/plugins/panel/logs/types';

import { calculateLogsLabelStats, calculateStats } from '../utils';

import { LogDetailsBody } from './LogDetailsBody';
import { LogDetailsRow } from './LogDetailsRow';
import { getLogLevelStyles, LogRowStyles } from './getLogRowStyles';
import { getAllFields, createLogLineLinks } from './logParser';

export interface Props extends Themeable2 {
  row: LogRowModel;
  showDuplicates: boolean;
  getRows: () => LogRowModel[];
  wrapLogMessage: boolean;
  className?: string;
  hasError?: boolean;
  app?: CoreApp;
  styles: LogRowStyles;

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

export const useAttributesExtensionLinks = (row: LogRowModel) => {
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

const withAttributesExtensionLinks = (Component: React.ComponentType<Props>) => {
  function ComponentWithLinks(props: Props) {
    const labelLinks = useAttributesExtensionLinks(props.row);
    return <Component {...props} links={labelLinks} />;
  }

  return ComponentWithLinks;
};

class UnThemedLogDetails extends PureComponent<Props> {
  render() {
    const {
      app,
      row,
      theme,
      hasError,
      onClickFilterOutLabel,
      onClickFilterLabel,
      getRows,
      showDuplicates,
      className,
      onClickShowField,
      onClickHideField,
      displayedFields,
      getFieldLinks,
      wrapLogMessage,
      onPinLine,
      styles,
      pinLineButtonTooltipTitle,
      links,
    } = this.props;
    const levelStyles = getLogLevelStyles(theme, row.logLevel);
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

    // If logs with error, we are not showing the level color
    const levelClassName = hasError
      ? ''
      : `${levelStyles.logsRowLevelColor} ${styles.logsRowLevel} ${styles.logsRowLevelDetails}`;

    return (
      <tr className={cx(className, styles.logDetails)}>
        {showDuplicates && <td />}
        <td className={levelClassName} aria-label={t('logs.un-themed-log-details.aria-label-log-level', 'Log level')} />
        <td colSpan={4}>
          <div className={styles.logDetailsContainer}>
            <table className={styles.logDetailsTable}>
              <tbody>
                {displayedFields && displayedFields.length > 0 && (
                  <>
                    <tr>
                      <td
                        colSpan={100}
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
                      theme={theme}
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
                        isFilterLabelActive={this.props.isFilterLabelActive}
                        links={links?.[key]}
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
                      isFilterLabelActive={this.props.isFilterLabelActive}
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
  }
}

export const LogDetails = withTheme2(withAttributesExtensionLinks(UnThemedLogDetails));
LogDetails.displayName = 'LogDetails';
