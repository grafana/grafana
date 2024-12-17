import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack, useStyles2 } from '@grafana/ui';
import { TraceSpan } from 'app/plugins/datasource/jaeger/_importedDependencies/types';

import AccordianKeyValues from '../TraceTimelineViewer/SpanDetail/AccordianKeyValues';
import { SpanOverviewList } from '../TraceTimelineViewer/SpanDetail/SpanOverviewList';

interface TFCSpanDetailsProps {
  span: TraceSpan;
  timeZone: string;
}

export function TFCSpanDetails(props: TFCSpanDetailsProps) {
  const { span, timeZone } = props;
  const { operationName, tags, process } = span;

  const styles = useStyles2(getStyles);

  return (
    <div data-testid="span-detail-component">
      <div className={styles.header}>
        <h2 className={styles.operationName} title={operationName}>
          {operationName}
        </h2>
        <div className={styles.listWrapper}>
          <SpanOverviewList className={styles.list} span={span} timeZone={timeZone} />
        </div>
      </div>
      <Stack direction="column">
        <AccordianKeyValues data={tags} label="Span Attributes" isOpen={true} />
        {process.tags && (
          <AccordianKeyValues
            className={styles.AccordianKeyValuesItem}
            data={process.tags}
            label="Resource Attributes"
            isOpen={true}
          />
        )}
      </Stack>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    header: css({
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: '0 1rem',
      marginBottom: '0.25rem',
    }),
    listWrapper: css({
      overflow: 'hidden',
    }),
    list: css({
      textAlign: 'right',
    }),
    operationName: css({
      margin: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      flexBasis: '50%',
      flexGrow: 0,
      flexShrink: 0,
    }),
    AccordianKeyValuesItem: css({
      marginBottom: theme.spacing(0.5),
    }),
  };
};
