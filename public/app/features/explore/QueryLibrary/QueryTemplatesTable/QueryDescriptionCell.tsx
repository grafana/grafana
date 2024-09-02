import { cx } from '@emotion/css';
import { CellProps } from 'react-table';

import { Spinner, Tooltip } from '@grafana/ui';

import { useDatasource } from '../utils/useDatasource';

import { useQueryLibraryListStyles } from './styles';
import { QueryTemplateRow } from './types';

export function QueryDescriptionCell(props: CellProps<QueryTemplateRow>) {
  const datasourceApi = useDatasource(props.row.original.datasourceRef);
  const styles = useQueryLibraryListStyles();

  if (!datasourceApi) {
    return <Spinner />;
  }

  if (!props.row.original.query) {
    return <div>No queries</div>;
  }
  const query = props.row.original.query;
  const queryDisplayText = datasourceApi?.getQueryDisplayText?.(query) || '';
  const description = props.row.original.description;
  const dsName = datasourceApi?.name || '';

  return (
    <div aria-label={`Query template for ${dsName}: ${description}`}>
      <p className={styles.header}>
        <img
          className={styles.logo}
          src={datasourceApi?.meta.info.logos.small || 'public/img/icn-datasource.svg'}
          alt={datasourceApi?.meta.info.description}
        />
        {dsName}
      </p>
      <Tooltip content={queryDisplayText} placement="bottom-start">
        <p className={cx(styles.mainText, styles.singleLine)}>{queryDisplayText}</p>
      </Tooltip>
      <p className={cx(styles.otherText, styles.singleLine)}>{description}</p>
    </div>
  );
}
