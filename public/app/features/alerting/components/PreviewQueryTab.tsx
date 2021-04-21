import React, { FC, useMemo, useState } from 'react';
import { css } from '@emotion/css';
import { getFrameDisplayName, GrafanaTheme, PanelData, SelectableValue } from '@grafana/data';
import { Button, Select, stylesFactory, Table, useTheme } from '@grafana/ui';
import { EmptyState } from './EmptyState';

interface Props {
  data: PanelData;
  width: number;
  height: number;
}

export const PreviewQueryTab: FC<Props> = ({ data, height, width }) => {
  const [currentSeries, setSeries] = useState<number>(0);
  const theme = useTheme();
  const styles = getStyles(theme, height);
  const series = useMemo<Array<SelectableValue<number>>>(() => {
    if (data?.series) {
      return data.series.map((frame, index) => ({ value: index, label: getFrameDisplayName(frame) }));
    }

    return [];
  }, [data]);

  // Select padding
  const padding = 16;

  if (!data) {
    return (
      <EmptyState title="Run queries to view data.">
        <Button>Run queries</Button>
      </EmptyState>
    );
  }

  if (!data.series) {
    return null;
  }

  if (data.series.length > 1) {
    return (
      <div className={styles.wrapper}>
        <div style={{ height: height - theme.spacing.formInputHeight - 16 }}>
          <Table
            data={data.series[currentSeries]}
            height={height - theme.spacing.formInputHeight - padding}
            width={width}
          />
        </div>
        <div className={styles.selectWrapper}>
          <Select
            onChange={(selectedValue) => setSeries(selectedValue.value!)}
            options={series}
            value={currentSeries}
          />
        </div>
      </div>
    );
  }

  return <Table data={data.series[0]} height={height} width={width} />;
};

const getStyles = stylesFactory((theme: GrafanaTheme, height: number) => {
  return {
    wrapper: css`
      label: preview-wrapper;
      height: ${height}px;
    `,
    selectWrapper: css`
      padding: ${theme.spacing.md};
    `,
  };
});
