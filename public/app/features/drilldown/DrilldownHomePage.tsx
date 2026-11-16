import { css } from '@emotion/css';

import { useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { DataSourceBar, dataSourcesKey, useFilledDataSources } from './DataSourceBar';
import { RealDataDrilldownPage } from './realdata/RealDataDrilldownPage';

// The page loads once every data source has a choice in the URL, and loads again when a choice changes.
export function DrilldownHomePage() {
  const styles = useStyles2(getStyles);
  const [queryParams] = useQueryParams();
  const dataSourcesFilled = useFilledDataSources();

  return (
    <div className={styles.container}>
      <DataSourceBar />
      {dataSourcesFilled && <RealDataDrilldownPage key={dataSourcesKey(queryParams)} />}
    </div>
  );
}

const getStyles = () => ({
  container: css({
    display: 'flex',
    flex: '1 1 0',
    flexDirection: 'column',
  }),
});

export default DrilldownHomePage;
