import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  LoadingState,
  type FieldConfigSource,
  type GrafanaTheme2,
  type PanelData,
  type TimeRange,
} from '@grafana/data';
import { ThemeContext } from '@grafana/ui';

import { type EmbedDataProvider, type EmbedPanelData } from '../data/types';
import { type EmbedPanel } from '../panel/normalize';
import { syncShadowStyles } from '../styles/shadowStyles';

import { EmbedPanelRenderer } from './EmbedPanelRenderer';

export interface EmbedPanelHostProps {
  panel: EmbedPanel;
  provider: EmbedDataProvider | undefined;
  theme: GrafanaTheme2;
  timeRange: TimeRange;
  /** The unresolved window, e.g. { from: 'now-6h', to: 'now' }. */
  rawRange: { from: string; to: string };
  /** Bumped by the element's refresh() to force a re-query of a relative range. */
  refreshNonce: number;
  width: number;
  height: number;
  timeZone: string;
  onChangeTimeRange: (fromMs: number, toMs: number) => void;
}

// No window yet: the element's current range is filled in below, so this does not
// have to invent one.
const EMPTY_DATA: EmbedPanelData = { series: [], state: LoadingState.Loading };

export function EmbedPanelHost({
  panel,
  provider,
  theme,
  timeRange,
  rawRange,
  refreshNonce,
  width,
  height,
  timeZone,
  onChangeTimeRange,
}: EmbedPanelHostProps) {
  const [data, setData] = useState<EmbedPanelData>(EMPTY_DATA);

  // Live field config. Starts as the panel's own and then evolves with interaction,
  // exactly as Explore does. Identity is stable unless it actually changes, because
  // EmbedPanelRenderer bumps structureRev on identity change.
  const [fieldConfig, setFieldConfig] = useState<FieldConfigSource>(panel.fieldConfig);
  useEffect(() => {
    setFieldConfig(panel.fieldConfig);
  }, [panel.fieldConfig]);

  // The element hands down a freshly built TimeRange on every render (GraphNG needs
  // that), and width changes on every resize tick, so keying this effect on either
  // would re-subscribe and re-query for cosmetic renders. The raw range is the
  // window the host actually asked for, so key on that and read the rest via a ref.
  const requestRef = useRef({ timeRange, width });
  requestRef.current = { timeRange, width };

  useEffect(() => {
    if (!provider) {
      return;
    }
    const unsubscribe = provider.subscribe(setData);
    const request = requestRef.current;
    provider.query?.({
      timeRange: request.timeRange,
      maxDataPoints: Math.max(1, Math.round(request.width)),
    });
    return unsubscribe;
    // A resize deliberately does not re-query: maxDataPoints is a resolution hint,
    // and refetching per pixel would mean a datasource round trip per resize tick.
  }, [provider, rawRange.from, rawRange.to, refreshNonce]);

  // Emotion inserts rules while components render and does so without touching the
  // DOM, so a post-commit sync is what actually gets Grafana's styles into the
  // shadow root.
  useLayoutEffect(() => {
    syncShadowStyles();
  });

  // A provider that supplied no window of its own gets the element's current one.
  const effectiveData: PanelData = useMemo(
    () => ({ ...data, timeRange: data.timeRange ?? timeRange }),
    [data, timeRange]
  );

  return (
    <ThemeContext.Provider value={theme}>
      <EmbedPanelRenderer
        pluginId={panel.pluginId}
        title={panel.title}
        data={effectiveData}
        fieldConfig={fieldConfig}
        options={panel.options}
        width={width}
        height={height}
        timeZone={timeZone}
        onFieldConfigChange={setFieldConfig}
        onChangeTimeRange={(range) => onChangeTimeRange(range.from, range.to)}
      />
    </ThemeContext.Provider>
  );
}
