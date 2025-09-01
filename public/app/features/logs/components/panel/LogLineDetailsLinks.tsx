import { css } from '@emotion/css';
import { memo, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { DataLinkButton, useStyles2 } from '@grafana/ui';

import { FieldDef } from '../logParser';

import { filterFields, MultipleValue, SingleValue } from './LogLineDetailsFields';
import { useLogListContext } from './LogListContext';
import { LogListModel } from './processing';

interface LogLineDetailsLinksProps {
  fields: FieldDef[];
  log: LogListModel;
  logs: LogListModel[];
  search?: string;
}

export const LogLineDetailsLinks = memo(({ fields, log, search }: LogLineDetailsLinksProps) => {
  const styles = useStyles2(getFieldsStyles);
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

const getFieldsStyles = (theme: GrafanaTheme2) => ({
  linksTable: css({
    display: 'grid',
    gap: theme.spacing(1),
    gridTemplateColumns: `auto 1fr`,
    marginBottom: theme.spacing(1),
  }),
});

interface LogLineDetailsFieldProps {
  field: FieldDef;
  log: LogListModel;
}

export const LogLineDetailsField = ({ field, log }: LogLineDetailsFieldProps) => {
  const { closeDetails, onPinLine, pinLineButtonTooltipTitle, syntaxHighlighting } = useLogListContext();

  const styles = useStyles2(getFieldStyles);

  const singleKey = field.keys.length === 1;
  const singleValue = field.values.length === 1;

  return (
    <>
      <div className={styles.label}>{singleKey ? field.keys[0] : <MultipleValue values={field.keys} />}</div>
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
      {/** @todo: do we need to show the value? */}
      {false && (
        <div>
          <div className={styles.value}>
            <div className={styles.valueContainer}>
              {singleValue ? (
                <SingleValue value={field.values[0]} syntaxHighlighting={syntaxHighlighting} />
              ) : (
                <MultipleValue showCopy={true} values={field.values} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const getFieldStyles = (theme: GrafanaTheme2) => ({
  label: css({
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
    paddingRight: theme.spacing(1),
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
