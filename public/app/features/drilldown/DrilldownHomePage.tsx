import { useEffect, useState } from 'react';

import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { SIGNALS, dataSourceParam, suggestDataSources } from './dataSources';
import { environmentParam } from './environment';
import { RealDataDrilldownPage } from './realdata/RealDataDrilldownPage';

// The page loads once every data source has a choice in the URL, and loads again when a choice or the environment
// changes.
export function DrilldownHomePage() {
  const [queryParams] = useQueryParams();
  const dataSourcesFilled = useFilledDataSources();

  return dataSourcesFilled ? <RealDataDrilldownPage key={viewKey(queryParams)} /> : null;
}

// On first load, writes the related data sources for every signal the URL leaves open into the URL, so the URL
// always names the data sources in use. Returns true once that is done, so a view loads once with its final choice.
function useFilledDataSources(): boolean {
  const [, updateQueryParams] = useQueryParams();
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fill = async () => {
      const suggestion = await suggestDataSources().catch((): Awaited<ReturnType<typeof suggestDataSources>> => ({}));
      const values: Record<string, string> = {};
      for (const signal of SIGNALS) {
        const uid = suggestion[signal];
        if (uid) {
          values[dataSourceParam(signal)] = uid;
        }
      }
      if (!cancelled) {
        if (Object.keys(values).length > 0) {
          updateQueryParams(values, true);
        }
        setFilled(true);
      }
    };
    fill();
    return () => {
      cancelled = true;
    };
  }, [updateQueryParams]);

  return filled;
}

// The key changes with any chosen data source and with the environment, so a view remounts and reloads when one changes.
function viewKey(queryParams: Record<string, unknown>): string {
  return [...SIGNALS.map((signal) => dataSourceParam(signal)), environmentParam]
    .map((param) => String(queryParams[param] ?? ''))
    .join('|');
}

export default DrilldownHomePage;
