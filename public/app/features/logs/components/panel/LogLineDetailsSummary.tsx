import { css } from '@emotion/css';
import { useCallback, useMemo } from 'react';

import { type Field, type GrafanaTheme2, type LinkModel, LogLevel } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Badge, type BadgeColor, DataLinkButton, useStyles2 } from '@grafana/ui';

import { createLogLineLinks } from '../logParser';

import { type LogListFontSize } from './LogList';
import { useLogListContext } from './LogListContext';
import { type LogListModel } from './processing';

interface LogLineDetailsSummaryProps {
  log: LogListModel;
}

export const LogLineDetailsSummary = ({ log }: LogLineDetailsSummaryProps) => {
  const { app, fontSize, noInteractions, pinLineButtonTooltipTitle, timestampResolution } = useLogListContext();
  const styles = useStyles2(getStyles, fontSize);
  const links = useMemo(() => collectLogLinks(log), [log]);
  const level = formatLevel(log.logLevel);
  const timestamp = timestampResolution === 'ms' ? log.timestamp : log.timestampNs;

  const reportLinkClick = useCallback(
    (fieldKey: string) => {
      if (noInteractions) {
        return;
      }
      reportInteraction('logs_log_line_details_derived_link_clicked', {
        app,
        fieldKey,
        datasourceType: log.datasourceType,
      });
    },
    [app, log.datasourceType, noInteractions]
  );

  return (
    <div className={styles.row}>
      <div className={styles.meta}>
        {level && <Badge color={getLevelBadgeColor(log.logLevel)} text={level} />}
        <span className={styles.timestamp}>{timestamp}</span>
      </div>
      {links.length > 0 && (
        <div className={styles.links}>
          {links.map(({ fieldKey, link }, index) => (
            <DataLinkButton
              key={`${link.title}-${index}`}
              buttonProps={{
                tooltip:
                  typeof pinLineButtonTooltipTitle === 'object' && link.onClick ? pinLineButtonTooltipTitle : undefined,
                variant: 'secondary',
                fill: 'outline',
                onClick: () => reportLinkClick(fieldKey),
              }}
              link={link}
            />
          ))}
        </div>
      )}
    </div>
  );
};

function collectLogLinks(log: LogListModel): Array<{ fieldKey: string; link: LinkModel<Field> }> {
  const fieldsWithLinks = log.fields.filter((field) => field.links?.length);
  const displayed = fieldsWithLinks.filter((field) => field.fieldIndex !== log.entryFieldIndex);
  const fromLogLine = createLogLineLinks(fieldsWithLinks.filter((field) => field.fieldIndex === log.entryFieldIndex));

  return [...displayed, ...fromLogLine].flatMap((field) =>
    (field.links ?? []).map((link) => ({
      fieldKey: field.keys[0] ?? '',
      link,
    }))
  );
}

function formatLevel(level: string) {
  if (!level) {
    return '';
  }
  return level.charAt(0).toUpperCase() + level.slice(1);
}

function getLevelBadgeColor(level: string): BadgeColor {
  switch (level) {
    case LogLevel.critical:
      return 'purple';
    case LogLevel.error:
      return 'red';
    case LogLevel.warning:
      return 'orange';
    case LogLevel.info:
      return 'blue';
    default:
      return 'darkgrey';
  }
}

const getStyles = (theme: GrafanaTheme2, fontSize: LogListFontSize) => ({
  row: css({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1),
    margin: theme.spacing(1, 1, 0, 1),
    fontSize: fontSize === 'small' ? theme.typography.bodySmall.fontSize : theme.typography.body.fontSize,
  }),
  meta: css({
    display: 'flex',
    alignItems: 'center',
    flex: '0 0 auto',
    gap: theme.spacing(2),
    justifyContent: 'flex-start',
    // Takes the free space on this line, so links sit on the right while they
    // fit beside the timestamp. Once they wrap, this no longer affects them.
    marginRight: 'auto',
  }),
  timestamp: css({
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamilyMonospace,
    whiteSpace: 'nowrap',
  }),
  links: css({
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    flex: '0 0 auto',
    width: 'max-content',
    maxWidth: '100%',
    minWidth: 'min(100%, max-content)',
  }),
});
