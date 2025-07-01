import { css } from '@emotion/css';
import { groupBy } from 'lodash';
import { useCallback, useMemo } from 'react';

import { DataFrameType, GrafanaTheme2, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ControlledCollapse, useStyles2 } from '@grafana/ui';

import { getLabelTypeFromRow } from '../../utils';
import { useAttributesExtensionLinks } from '../LogDetails';
import { createLogLineLinks } from '../logParser';

import { LabelWithLinks, LogLineDetailsFields, LogLineDetailsLabelFields } from './LogLineDetailsFields';
import { LogListModel } from './processing';

interface LogLineDetailsComponentProps {
  log: LogListModel;
  logOptionsStorageKey?: string;
  logs: LogListModel[];
}

export const LogLineDetailsComponent = ({ log, logOptionsStorageKey, logs }: LogLineDetailsComponentProps) => {
  const styles = useStyles2(getStyles);
  const extensionLinks = useAttributesExtensionLinks(log);
  const fieldsWithLinks = useMemo(() => {
    const fieldsWithLinks = log.fields.filter((f) => f.links?.length);
    const displayedFieldsWithLinks = fieldsWithLinks.filter((f) => f.fieldIndex !== log.entryFieldIndex).sort();
    const hiddenFieldsWithLinks = fieldsWithLinks.filter((f) => f.fieldIndex === log.entryFieldIndex).sort();
    const fieldsWithLinksFromVariableMap = createLogLineLinks(hiddenFieldsWithLinks);
    return [...displayedFieldsWithLinks, ...fieldsWithLinksFromVariableMap];
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
  const linksOpen = logOptionsStorageKey
    ? store.getBool(`${logOptionsStorageKey}.log-details.linksOpen`, false)
    : false;
  const fieldsOpen = logOptionsStorageKey
    ? store.getBool(`${logOptionsStorageKey}.log-details.fieldsOpen`, false)
    : false;

  const handleToggle = useCallback(
    (option: string, isOpen: boolean) => {
      store.set(`${logOptionsStorageKey}.log-details.${option}`, isOpen);
    },
    [logOptionsStorageKey]
  );

  return (
    <div className={styles.componentWrapper}>
      <ControlledCollapse
        label={t('logs.log-line-details.log-line-section', 'Log line')}
        collapsible
        isOpen={logLineOpen}
        onToggle={(isOpen: boolean) => handleToggle('logLineOpen', isOpen)}
      >
        {log.raw}
      </ControlledCollapse>
      {fieldsWithLinks.length > 0 && (
        <ControlledCollapse
          label={t('logs.log-line-details.links-section', 'Links')}
          collapsible
          isOpen={linksOpen}
          onToggle={(isOpen: boolean) => handleToggle('linksOpen', isOpen)}
        >
          <LogLineDetailsFields log={log} logs={logs} fields={fieldsWithLinks} />
        </ControlledCollapse>
      )}
      {labelGroups.map((group) =>
        group === '' ? (
          <ControlledCollapse
            key={'fields'}
            label={t('logs.log-line-details.fields-section', 'Fields')}
            collapsible
            isOpen={fieldsOpen}
            onToggle={(isOpen: boolean) => handleToggle('fieldsOpen', isOpen)}
          >
            <LogLineDetailsLabelFields log={log} logs={logs} fields={groupedLabels[group]} />
            <LogLineDetailsFields log={log} logs={logs} fields={fieldsWithoutLinks} />
          </ControlledCollapse>
        ) : (
          <ControlledCollapse key={group} label={group} collapsible isOpen={true}>
            <LogLineDetailsLabelFields log={log} logs={logs} fields={groupedLabels[group]} />
          </ControlledCollapse>
        )
      )}
      {!labelGroups.length && (
        <ControlledCollapse
          key={'fields'}
          label={t('logs.log-line-details.fields-section', 'Fields')}
          collapsible
          isOpen={fieldsOpen}
          onToggle={(isOpen: boolean) => handleToggle('fieldsOpen', isOpen)}
        >
          <LogLineDetailsFields log={log} logs={logs} fields={fieldsWithoutLinks} />
        </ControlledCollapse>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  componentWrapper: css({
    padding: theme.spacing(0, 1, 1, 1),
  }),
});
