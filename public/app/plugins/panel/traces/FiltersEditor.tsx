import { useEffect, useMemo } from 'react';

import { StandardEditorProps, TraceSearchProps } from '@grafana/data';
import { AdHocFiltersComboboxRenderer } from '@grafana/scenes';

import { useTraceAdHocFiltersController } from '../../../features/explore/TraceView/components/TracePageHeader/useTraceAdHocFiltersController';
import { transformDataFrames } from '../../../features/explore/TraceView/utils/transform';

type Props = StandardEditorProps<TraceSearchProps, unknown, TraceSearchProps>;

export const FiltersEditor = ({ value, onChange, context }: Props) => {
  const trace = useMemo(() => transformDataFrames(context.data[0]), [context.data]);

  useEffect(() => {
    if (!value.adhocFilters) {
      onChange({ ...value, adhocFilters: [] });
    }
  }, [onChange, value]);

  const controller = useTraceAdHocFiltersController(trace, value, onChange);

  if (!trace || !controller) {
    return null;
  }

  return <AdHocFiltersComboboxRenderer controller={controller} />;
};
