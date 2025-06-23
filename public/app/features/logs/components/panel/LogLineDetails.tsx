import { css } from '@emotion/css';
import { Resizable } from 're-resizable';
import { useCallback, useMemo, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ControlledCollapse, getDragStyles, IconButton, useStyles2 } from '@grafana/ui';
import { GetFieldLinksFn } from 'app/plugins/panel/logs/types';

import { LogDetails } from './LogDetails';
import { useLogListContext } from './LogListContext';
import { LogListModel } from './processing';
import { LOG_LIST_MIN_WIDTH } from './virtualization';
import { createLogLineLinks } from '../logParser';

interface Props {
  containerElement: HTMLDivElement;
  getFieldLinks?: GetFieldLinksFn;
  logs: LogListModel[];
  onResize(): void;
}

export const LogLineDetails = ({ containerElement, getFieldLinks, logs, onResize }: Props) => {
  const {
    app,
    closeDetails,
    detailsWidth,
    displayedFields,
    isLabelFilterActive,
    onClickFilterLabel,
    onClickFilterOutLabel,
    onClickShowField,
    onClickHideField,
    onPinLine,
    pinLineButtonTooltipTitle,
    setDetailsWidth,
    showDetails,
    wrapLogMessage,
  } = useLogListContext();
  const getRows = useCallback(() => logs, [logs]);
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
          <table width="100%" style={{ display: 'none' }}>
            <tbody>
              <LogDetails
                getRows={getRows}
                row={showDetails[0]}
                showDuplicates={false}
                wrapLogMessage={wrapLogMessage}
                onPinLine={onPinLine}
                getFieldLinks={getFieldLinks}
                onClickFilterLabel={onClickFilterLabel}
                onClickFilterOutLabel={onClickFilterOutLabel}
                onClickShowField={onClickShowField}
                onClickHideField={onClickHideField}
                hasError={showDetails[0].hasError}
                displayedFields={displayedFields}
                app={app}
                isFilterLabelActive={isLabelFilterActive}
                pinLineButtonTooltipTitle={pinLineButtonTooltipTitle}
              />
            </tbody>
          </table>
          <LogDetailsComponent log={showDetails[0]} styles={styles} />
        </div>
      </div>
    </Resizable>
  );
};

const LogDetailsComponent = ({ log, styles }: { log: LogListModel; styles: LogLineDetailsStyles }) => {
  const links = useMemo(() => {
    const fieldsWithLinks = log.fields.filter((f) => f.links?.length);
    const displayedFieldsWithLinks = fieldsWithLinks.filter((f) => f.fieldIndex !== log.entryFieldIndex).sort();
    const hiddenFieldsWithLinks = fieldsWithLinks.filter((f) => f.fieldIndex === log.entryFieldIndex).sort();
    const fieldsWithLinksFromVariableMap = createLogLineLinks(hiddenFieldsWithLinks);
    return [...displayedFieldsWithLinks, ...fieldsWithLinksFromVariableMap];
  }, [log.entryFieldIndex, log.fields]);

  return (
    <div className={styles.componentWrapper}>
      <ControlledCollapse label={t('logs.log-line-details.log-line-section', 'Log line')} collapsible>
        {log.raw}
      </ControlledCollapse>
      <ControlledCollapse label={t('logs.log-line-details.links-section', 'Links')} collapsible>
        {links.map((link, i) => (
          <div key={i}>Link</div>
        ))}
      </ControlledCollapse>
      <ControlledCollapse
        label={t('logs.log-line-details.structured-metadata-section', 'Structured metadata')}
        collapsible
      >
        <p>Metadata</p>
      </ControlledCollapse>
      <ControlledCollapse label={t('logs.log-line-details.parsed-fields-section', 'Parsed fields')} collapsible>
        <p>Fields</p>
      </ControlledCollapse>
      <ControlledCollapse label={t('logs.log-line-details.indexed-labels-section', 'Indexed labels')} collapsible>
        <p>Labels</p>
      </ControlledCollapse>
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
