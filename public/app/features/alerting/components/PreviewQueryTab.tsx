import React, { FC, useMemo, useState } from 'react';
import { getFrameDisplayName, GrafanaTheme, PanelData, SelectableValue, toDataFrame } from '@grafana/data';
import { Select, stylesFactory, Table, useTheme } from '@grafana/ui';
import { css } from 'emotion';

interface Props {
  data?: PanelData;
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

  if (!data?.series?.length) {
    return <Table data={toDataFrame([])} height={height} width={width} />;
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
      height: ${height}px;
    `,
    selectWrapper: css`
      padding: ${theme.spacing.md};
    `,
  };
});
