import { css } from '@emotion/css';
import { camelCase, groupBy } from 'lodash';
import { startTransition, useCallback, useMemo, useRef, useState } from 'react';

import { DataFrameType, GrafanaTheme2, store } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { ControlledCollapse, useStyles2 } from '@grafana/ui';

import { getLabelTypeFromRow } from '../../utils';
import { useAttributesExtensionLinks } from '../LogDetails';
import { createLogLineLinks } from '../logParser';

import { LogLineDetailsDisplayedFields } from './LogLineDetailsDisplayedFields';
import { LabelWithLinks, LogLineDetailsFields, LogLineDetailsLabelFields } from './LogLineDetailsFields';
import { LogLineDetailsHeader } from './LogLineDetailsHeader';
import { LogLineDetailsLog } from './LogLineDetailsLog';
import { useLogListContext } from './LogListContext';
import { LogListModel } from './processing';

interface LogLineDetailsComponentProps {
  log: LogListModel;
  logs: LogListModel[];
}

export const LogLineDetailsComponent = ({ log, logs }: LogLineDetailsComponentProps) => {
  const { displayedFields, logOptionsStorageKey, setDisplayedFields } = useLogListContext();
  const [search, setSearch] = useState('');
  const inputRef = useRef('');
  const styles = useStyles2(getStyles);
  const extensionLinks = useAttributesExtensionLinks(log);
  const fieldsWithLinks = useMemo(() => {
    const fieldsWithLinks = log.fields.filter((f) => f.links?.length);
    const displayedFieldsWithLinks = fieldsWithLinks.filter((f) => f.fieldIndex !== log.entryFieldIndex).sort();
    const hiddenFieldsWithLinks = fieldsWithLinks.filter((f) => f.fieldIndex === log.entryFieldIndex).sort();
    const fieldsWithLinksFromVariableMap = createLogLineLinks(hiddenFieldsWithLinks);
    return {
      links: displayedFieldsWithLinks,
      linksFromVariableMap: fieldsWithLinksFromVariableMap,
    };
  }, [log.entryFieldIndex, log.fields]);
  const fieldsWithoutLinks =
    log.dataFrame.meta?.type === DataFrameType.LogLines
      ? // for LogLines frames (dataplane) we don't want to show any additional fields besides already extracted labels and links
        []
      : // for other frames, do not show the log message unless there is a link attached
        log.fields.filter((f) => f.links?.length === 0 && f.fieldIndex !== log.entryFieldIndex).sort();
  const labelsWithLinks: LabelWithLinks[] = useMemo(
    () =>
      Object.keys(log.labels)
        .sort()
        .map((label) => ({
          key: label,
          value: log.labels[label],
          link: extensionLinks?.[label],
        })),
    [extensionLinks, log.labels]
  );
  const groupedLabels = useMemo(
    () => groupBy(labelsWithLinks, (label) => getLabelTypeFromRow(label.key, log, true) ?? ''),
    [labelsWithLinks, log]
  );
  const labelGroups = useMemo(() => Object.keys(groupedLabels), [groupedLabels]);

  const logLineOpen = logOptionsStorageKey
    ? store.getBool(`${logOptionsStorageKey}.log-details.logLineOpen`, false)
    : false;
  const linksOpen = logOptionsStorageKey ? store.getBool(`${logOptionsStorageKey}.log-details.linksOpen`, true) : true;
  const fieldsOpen = logOptionsStorageKey
    ? store.getBool(`${logOptionsStorageKey}.log-details.fieldsOpen`, true)
    : true;
  const displayedFieldsOpen = logOptionsStorageKey
    ? store.getBool(`${logOptionsStorageKey}.log-details.displayedFieldsOpen`, false)
    : false;

  const handleToggle = useCallback(
    (option: string, isOpen: boolean) => {
      store.set(`${logOptionsStorageKey}.log-details.${option}`, isOpen);
    },
    [logOptionsStorageKey]
  );

  const handleSearch = useCallback((newSearch: string) => {
    inputRef.current = newSearch;
    startTransition(() => {
      setSearch(inputRef.current);
    });
  }, []);

  const noDetails =
    !fieldsWithLinks.links.length &&
    !fieldsWithLinks.linksFromVariableMap.length &&
    !labelGroups.length &&
    !fieldsWithoutLinks.length;

  return (
    <>
      <LogLineDetailsHeader log={log} search={search} onSearch={handleSearch} />
      <div className={styles.componentWrapper}>
        <ControlledCollapse
          className={styles.collapsable}
          label={t('logs.log-line-details.log-line-section', 'Log line')}
          collapsible
          isOpen={logLineOpen}
          onToggle={(isOpen: boolean) => handleToggle('logLineOpen', isOpen)}
        >
          <LogLineDetailsLog log={log} />
        </ControlledCollapse>
        {displayedFields.length > 0 && setDisplayedFields && (
          <ControlledCollapse
            label={t('logs.log-line-details.displayed-fields-section', 'Organize displayed fields')}
            collapsible
            isOpen={displayedFieldsOpen}
            onToggle={(isOpen: boolean) => handleToggle('displayedFieldsOpen', isOpen)}
          >
            <LogLineDetailsDisplayedFields />
          </ControlledCollapse>
        )}
        {fieldsWithLinks.links.length > 0 && (
          <ControlledCollapse
            className={styles.collapsable}
            label={t('logs.log-line-details.links-section', 'Links')}
            collapsible
            isOpen={linksOpen}
            onToggle={(isOpen: boolean) => handleToggle('linksOpen', isOpen)}
          >
            <LogLineDetailsFields log={log} logs={logs} fields={fieldsWithLinks.links} search={search} />
            <LogLineDetailsFields
              disableActions
              log={log}
              logs={logs}
              fields={fieldsWithLinks.linksFromVariableMap}
              search={search}
            />
          </ControlledCollapse>
        )}
        {labelGroups.map((group) =>
          group === '' ? (
            <ControlledCollapse
              className={styles.collapsable}
              key={'fields'}
              label={t('logs.log-line-details.fields-section', 'Fields')}
              collapsible
              isOpen={fieldsOpen}
              onToggle={(isOpen: boolean) => handleToggle('fieldsOpen', isOpen)}
            >
              <LogLineDetailsLabelFields log={log} logs={logs} fields={groupedLabels[group]} search={search} />
              <LogLineDetailsFields log={log} logs={logs} fields={fieldsWithoutLinks} search={search} />
            </ControlledCollapse>
          ) : (
            <ControlledCollapse
              className={styles.collapsable}
              key={group}
              label={group}
              collapsible
              isOpen={store.getBool(`${logOptionsStorageKey}.log-details.${groupOptionName(group)}`, true)}
              onToggle={(isOpen: boolean) => handleToggle(groupOptionName(group), isOpen)}
            >
              <LogLineDetailsLabelFields log={log} logs={logs} fields={groupedLabels[group]} search={search} />
            </ControlledCollapse>
          )
        )}
        {!labelGroups.length && fieldsWithoutLinks.length > 0 && (
          <ControlledCollapse
            className={styles.collapsable}
            key={'fields'}
            label={t('logs.log-line-details.fields-section', 'Fields')}
            collapsible
            isOpen={fieldsOpen}
            onToggle={(isOpen: boolean) => handleToggle('fieldsOpen', isOpen)}
          >
            <LogLineDetailsFields log={log} logs={logs} fields={fieldsWithoutLinks} search={search} />
          </ControlledCollapse>
        )}
        {noDetails && <Trans i18nKey="logs.log-line-details.no-details">No fields to display.</Trans>}
      </div>
    </>
  );
};

function groupOptionName(group: string) {
  return `${camelCase(group)}Open`;
}

const getStyles = (theme: GrafanaTheme2) => ({
  collapsable: css({
    '&:last-of-type': {
      marginBottom: 0,
    },
  }),
  componentWrapper: css({
    padding: theme.spacing(0, 1, 1, 1),
  }),
});
