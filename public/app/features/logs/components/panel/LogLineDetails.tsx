import { css } from '@emotion/css';
import { groupBy } from 'lodash';
import { Resizable } from 're-resizable';
import { useCallback, useMemo, useRef } from 'react';

import { DataFrameType, GrafanaTheme2, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ControlledCollapse, getDragStyles, IconButton, useStyles2 } from '@grafana/ui';

import { getLabelTypeFromRow } from '../../utils';
import { useAttributesExtensionLinks } from '../LogDetails';
import { createLogLineLinks } from '../logParser';

import { LabelWithLinks, LogDetailsFields, LogDetailsLabelFields } from './LogLineDetailsFields';
import { useLogListContext } from './LogListContext';
import { LogListModel } from './processing';
import { LOG_LIST_MIN_WIDTH } from './virtualization';

interface Props {
  containerElement: HTMLDivElement;
  logOptionsStorageKey?: string;
  logs: LogListModel[];
  onResize(): void;
}

export const LogLineDetails = ({ containerElement, logOptionsStorageKey, logs, onResize }: Props) => {
  const { closeDetails, detailsWidth, setDetailsWidth, showDetails } = useLogListContext();
  const styles = useStyles2(getStyles);
  const dragStyles = useStyles2(getDragStyles);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleResize = useCallback(() => {
    if (containerRef.current) {
      setDetailsWidth(containerRef.current.clientWidth);
    }
    onResize();
  }, [onResize, setDetailsWidth]);

  const maxWidth = containerElement.clientWidth - LOG_LIST_MIN_WIDTH;

  return (
    <Resizable
      onResize={handleResize}
      handleClasses={{ left: dragStyles.dragHandleVertical }}
      defaultSize={{ width: detailsWidth, height: containerElement.clientHeight }}
      size={{ width: detailsWidth, height: containerElement.clientHeight }}
      enable={{ left: true }}
      minWidth={40}
      maxWidth={maxWidth}
    >
      <div className={styles.container} ref={containerRef}>
        <div className={styles.scrollContainer}>
          <IconButton
            name="times"
            className={styles.closeIcon}
            aria-label={t('logs.log-details.close', 'Close log details')}
            onClick={closeDetails}
          />
          <LogDetailsComponent
            log={showDetails[0]}
            logOptionsStorageKey={logOptionsStorageKey}
            logs={logs}
            styles={styles}
          />
        </div>
      </div>
    </Resizable>
  );
};

interface LogDetailsComponentProps {
  log: LogListModel;
  logOptionsStorageKey?: string;
  logs: LogListModel[];
  styles: LogLineDetailsStyles;
}

const LogDetailsComponent = ({ log, logOptionsStorageKey, logs, styles }: LogDetailsComponentProps) => {
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
          <LogDetailsFields log={log} logs={logs} fields={fieldsWithLinks} />
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
            <LogDetailsLabelFields log={log} logs={logs} fields={groupedLabels[group]} />
            <LogDetailsFields log={log} logs={logs} fields={fieldsWithoutLinks} />
          </ControlledCollapse>
        ) : (
          <ControlledCollapse key={group} label={group} collapsible isOpen={true}>
            <LogDetailsLabelFields log={log} logs={logs} fields={groupedLabels[group]} />
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
          <LogDetailsFields log={log} logs={logs} fields={fieldsWithoutLinks} />
        </ControlledCollapse>
      )}
    </div>
  );
};

export type LogLineDetailsStyles = ReturnType<typeof getStyles>;
const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    overflow: 'auto',
    height: '100%',
  }),
  scrollContainer: css({
    overflow: 'auto',
    position: 'relative',
    height: '100%',
  }),
  closeIcon: css({
    position: 'absolute',
    top: theme.spacing(1),
    right: theme.spacing(1.5),
  }),
  componentWrapper: css({
    padding: theme.spacing(0, 1, 1, 1),
  }),
});
