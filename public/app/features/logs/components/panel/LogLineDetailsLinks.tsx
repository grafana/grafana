import { css } from '@emotion/css';
import { memo, useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { DataLinkButton, Icon, Toggletip } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

import { type FieldDef } from '../logParser';

import { useLogDetailsContext } from './LogDetailsContext';
import { filterFields, MultipleValue, SingleValue } from './LogLineDetailsFields';
import { type LogListFontSize } from './LogList';
import { useLogListContext } from './LogListContext';
import { type LogListModel } from './processing';

interface LogLineDetailsLinksProps {
  fields: FieldDef[];
  log: LogListModel;
  logs: LogListModel[];
  search?: string;
}

export const LogLineDetailsLinks = memo(({ fields, log, search }: LogLineDetailsLinksProps) => {
  const { fontSize } = useLogListContext();
  const styles = useStyles2(getFieldsStyles, fontSize);
  const filteredFields = useMemo(() => (search ? filterFields(fields, search) : fields), [fields, search]);

  if (!fields.length) {
    return null;
  } else if (filteredFields.length === 0) {
    return t('logs.log-line-details.search.no-results', 'No results to display.');
  }

  return (
    <div className={styles.linksTable}>
      {filteredFields.map((field, i) => (
        <LogLineDetailsField key={`${field.keys[0]}=${field.values[0]}-${i}`} field={field} log={log} />
      ))}
    </div>
  );
});
LogLineDetailsLinks.displayName = 'LogLineDetailsLinks';

const getFieldsStyles = (theme: GrafanaTheme2, fontSize: LogListFontSize) => ({
  linksTable: css({
    display: 'grid',
    gap: fontSize === 'small' ? theme.spacing(0.25, 0.5) : theme.spacing(0.5, 1),
    gridTemplateColumns: `fit-content(30%) 1fr`,
    marginBottom: theme.spacing(1),
  }),
});

interface LogLineDetailsFieldProps {
  field: FieldDef;
  log: LogListModel;
}

export const LogLineDetailsField = ({ field, log }: LogLineDetailsFieldProps) => {
  const { onPinLine, pinLineButtonTooltipTitle, prettifyJSON } = useLogListContext();
  const { closeDetails } = useLogDetailsContext();

  const styles = useStyles2(getFieldStyles);

  const singleKey = field.keys.length === 1;
  const singleValue = field.values.length === 1;

  const tooltip = useMemo(
    () => (
      <div className={styles.value}>
        <div className={styles.valueContainer}>
          {singleValue ? (
            <SingleValue value={field.values[0]} prettifyJSON={prettifyJSON} />
          ) : (
            <MultipleValue showCopy={true} values={field.values} />
          )}
        </div>
      </div>
    ),
    [field.values, singleValue, styles.value, styles.valueContainer, prettifyJSON]
  );

  return (
    <>
      <div className={styles.label}>
        {singleKey ? field.keys[0] : <MultipleValue values={field.keys} />}
        <Toggletip fitContent content={tooltip}>
          <Icon
            aria-label={t('logs.log-line-details.link-value-tooltip', 'Link value')}
            className={styles.labelIcon}
            name="info-circle"
          />
        </Toggletip>
      </div>
      <div className={styles.links}>
        {field.links?.map((link, i) => {
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
            <span key={`${link.title}-${i}`} className={styles.link}>
              <DataLinkButton
                buttonProps={{
                  // Show tooltip message if max number of pinned lines has been reached
                  tooltip:
                    typeof pinLineButtonTooltipTitle === 'object' && link.onClick
                      ? pinLineButtonTooltipTitle
                      : undefined,
                  variant: 'secondary',
                  fill: 'outline',
                }}
                link={link}
              />
            </span>
          );
        })}
      </div>
    </>
  );
};

const getFieldStyles = (theme: GrafanaTheme2) => ({
  label: css({
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
    paddingRight: theme.spacing(1),
  }),
  labelIcon: css({
    marginLeft: theme.spacing(1),
  }),
  value: css({
    button: {
      visibility: 'hidden',
    },
    '&:hover': {
      button: {
        visibility: 'visible',
      },
    },
  }),
  links: css({
    paddingBottom: theme.spacing(0.5),
  }),
  link: css({
    marginRight: theme.spacing(0.5),
  }),
  valueContainer: css({
    display: 'flex',
    lineHeight: theme.typography.body.lineHeight,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    maxHeight: '50vh',
    overflow: 'auto',
  }),
});
