import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { testIds } from '../../components/LokiQueryEditor';
import { LokiQueryField } from '../../components/LokiQueryField';
import { LokiQueryEditorProps } from '../../components/types';

import { LokiQueryBuilderExplained } from './LokiQueryBuilderExplained';

type Props = LokiQueryEditorProps & {
  showExplain: boolean;
};

export function LokiQueryCodeEditor({
  query,
  datasource,
  range,
  onRunQuery,
  onChange,
  data,
  app,
  showExplain,
  history,
}: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <LokiQueryField
        datasource={datasource}
        query={query}
        range={range}
        onRunQuery={onRunQuery}
        onChange={onChange}
        history={history}
        data={data}
        app={app}
        data-testid={testIds.editor}
      />
      {showExplain && <LokiQueryBuilderExplained query={query.expr} />}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      maxWidth: '100%',
      '.gf-form': {
        marginBottom: 0.5,
      },
    }),
    buttonGroup: css({
      border: `1px solid ${theme.colors.border.medium}`,
      borderTop: 'none',
      padding: theme.spacing(0.5, 0.5, 0.5, 0.5),
      marginBottom: theme.spacing(0.5),
      display: 'flex',
      flexGrow: 1,
      justifyContent: 'end',
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    hint: css({
      color: theme.colors.text.disabled,
      whiteSpace: 'nowrap',
      cursor: 'help',
    }),
  };
};
