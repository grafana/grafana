import { useMemo } from 'react';
import { PanelData } from '@grafana/data';

interface GetFlamebearersProps {
  data: PanelData;
}

export const useGetFlamebearers = ({ data }: GetFlamebearersProps) => {
  const flamebearers = useMemo(
    () => (data?.state === 'Done' ? data?.series?.map((s) => (s?.fields?.[0]?.values as any)?.buffer[0]) : []),
    [data]
  );

  return flamebearers;
};
