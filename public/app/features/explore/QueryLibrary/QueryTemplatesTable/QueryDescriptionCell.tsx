import { css, cx } from '@emotion/css';
import { CellProps } from 'react-table';

import { GrafanaTheme2 } from '@grafana/data';
import { Spinner, Tooltip, useStyles2 } from '@grafana/ui';

import { useDatasource } from '../utils/useDatasource';

import { useQueryLibraryListStyles } from './styles';
import { QueryTemplateRow } from './types';

export function QueryDescriptionCell(props: CellProps<QueryTemplateRow>) {
  const datasourceApi = useDatasource(props.row.original.datasourceRef);
  const queryLibraryListStyles = useQueryLibraryListStyles();
  const styles = useStyles2(getStyles);

  if (!datasourceApi) {
    return <Spinner />;
  }

  if (!props.row.original.query) {
    return <div>No queries</div>;
  }
  const queryDisplayText = props.row.original.queryText;
  const description = props.row.original.description;
  const dsName = props.row.original.datasourceName;

  return (
    <div className={styles.container} aria-label={`Query template for ${dsName}: ${description}`}>
      <p className={queryLibraryListStyles.header}>
        <img
          className={queryLibraryListStyles.logo}
          src={datasourceApi?.meta.info.logos.small || 'public/img/icn-datasource.svg'}
          alt={datasourceApi?.meta.info.description}
        />
        {dsName}
      </p>
      <Tooltip content={queryDisplayText ?? ''} placement="bottom-start">
        <p className={cx(queryLibraryListStyles.mainText, queryLibraryListStyles.singleLine, styles.queryDisplayText)}>
          {queryDisplayText}
        </p>
      </Tooltip>
      <p className={cx(queryLibraryListStyles.otherText, queryLibraryListStyles.singleLine)}>{description}</p>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    maxWidth: theme.spacing(60),
  }),
  queryDisplayText: css({
    backgroundColor: theme.colors.background.canvas,
  }),
});
