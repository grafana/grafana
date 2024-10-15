import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { GrafanaTheme2, QueryHint } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Button, Tooltip, useStyles2 } from '@grafana/ui';

import { PromQueryEditorProps } from '../../components/types';

export function QueryEditorHints(props: PromQueryEditorProps) {
  const [hints, setHints] = useState<QueryHint[]>([]);
  const { query, data, datasource } = props;
  const styles = useStyles2(getStyles);

  useEffect(() => {
    const promQuery = { expr: query.expr, refId: query.refId };
    const hints = datasource.getQueryHints(promQuery, data?.series || []).filter((hint) => hint.fix?.action);
    setHints(hints);
  }, [datasource, data, query]);

  return (
    <>
      {hints.length > 0 && (
        <div className={styles.container}>
          {hints.map((hint) => {
            return (
              <Tooltip content={`${hint.label} ${hint.fix?.label}`} key={hint.type}>
                <Button onClick={() => onHintButtonClick(hint, props)} fill="outline" size="sm" className={styles.hint}>
                  hint: {hint.fix?.title || hint.fix?.action?.type.toLowerCase().replace('_', ' ')}
                </Button>
              </Tooltip>
            );
          })}
        </div>
      )}
    </>
  );
}

function onHintButtonClick(hint: QueryHint, props: PromQueryEditorProps) {
  reportInteraction('grafana_query_builder_hints_clicked', {
    hint: hint.type,
    datasourceType: props.datasource.type,
  });

  if (hint.fix?.action) {
    const newQuery = props.datasource.modifyQuery(props.query, hint.fix.action);
    return props.onChange(newQuery);
  }
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      alignItems: 'start',
    }),
    hint: css({
      marginRight: theme.spacing(1),
      padEnd: theme.spacing(2),
    }),
  };
};
