import { cloneDeep } from 'lodash';
import { memo, useMemo } from 'react';

import { applyFieldOverrides, DataFrame, PanelProps } from '@grafana/data';
import { config } from '@grafana/runtime';
import { usePanelContext } from '@grafana/ui';
import { MetaInfoText } from 'app/features/explore/MetaInfoText';
import RawListContainer from 'app/features/explore/PrometheusListView/RawListContainer';

import { Options } from './panelcfg.gen';

interface Props extends PanelProps<Options> {}

export const RawPrometheusPanel = memo(({ data, options, fieldConfig, replaceVariables, timeZone }: Props) => {
  const panelContext = usePanelContext();

  // Process data with field overrides (memoized)
  const processedData = useMemo(() => {
    const frames = data.series ?? [];
    if (!frames.length) {
      return frames;
    }

    // Clone to avoid mutating frozen data
    const cloned = cloneDeep(frames);
    return applyFieldOverrides({
      data: cloned,
      timeZone: timeZone ?? 'browser',
      theme: config.theme2,
      replaceVariables,
      fieldConfig,
      dataLinkPostProcessor: panelContext.dataLinkPostProcessor,
    });
  }, [data.series, timeZone, replaceVariables, fieldConfig, panelContext.dataLinkPostProcessor]);

  // Filter out empty frames
  const frames = processedData?.filter(
    (frame: DataFrame | undefined): frame is DataFrame => !!frame && frame.length !== 0
  );

  if (!frames?.length) {
    return <MetaInfoText metaItems={[{ value: '0 series returned' }]} />;
  }

  return <RawListContainer tableResult={frames[0]} defaultExpanded={options.expandedView} />;
});

RawPrometheusPanel.displayName = 'RawPrometheusPanel';
