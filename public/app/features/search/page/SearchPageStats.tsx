import React from 'react';
import { DataFrame, GrafanaTheme2, LoadingState } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';

type Props = {
  panelTypes: DataFrame;
  schemaVersions: DataFrame;
  width: number;
};

export const SearchPageStats = ({ panelTypes, schemaVersions, width }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <>
      <h1>Stats</h1>
      <table className={styles.table}>
        <tr>
          <td>
            <PanelRenderer
              pluginId="table"
              title="Panels"
              data={{ series: [panelTypes], state: LoadingState.Done } as any}
              options={{}}
              width={width / 2}
              height={200}
              fieldConfig={{ defaults: {}, overrides: [] }}
              timeZone="browser"
            />
          </td>
          <td>
            <PanelRenderer
              pluginId="table"
              title="Panels"
              data={{ series: [schemaVersions], state: LoadingState.Done } as any}
              options={{}}
              width={width / 2}
              height={200}
              fieldConfig={{ defaults: {}, overrides: [] }}
              timeZone="browser"
            />
          </td>
        </tr>
      </table>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  table: css`
    width: 100%;
  `,
});
