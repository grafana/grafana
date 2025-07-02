import { useCallback } from 'react';

import { FrameMatcherID, MatcherConfig, StandardEditorProps } from '@grafana/data';
import { t } from '@grafana/i18n';
import { RefIDMultiPicker, RefIDPicker, stringsToRegexp } from '@grafana/ui/internal';

type Props = StandardEditorProps<MatcherConfig>;

export const FrameSelectionEditor = ({ value, context, onChange }: Props) => {
  const onFilterChange = useCallback(
    (v: string) => {
      onChange(
        v?.length
          ? {
              id: FrameMatcherID.byRefId,
              options: v,
            }
          : undefined
      );
    },
    [onChange]
  );

  return (
    <RefIDPicker
      value={value?.options}
      onChange={onFilterChange}
      data={context.data}
      placeholder={t('geomap.frame-selection-editor.placeholder-change-filter', 'Change filter')}
    />
  );
};

type FrameMultiSelectionEditorProps = Omit<StandardEditorProps<MatcherConfig>, 'item'>;

export const FrameMultiSelectionEditor = ({ value, context, onChange }: FrameMultiSelectionEditorProps) => {
  const onFilterChange = useCallback(
    (v: string[]) => {
      onChange(
        v?.length
          ? {
              id: FrameMatcherID.byRefId,
              options: stringsToRegexp(v),
            }
          : undefined
      );
    },
    [onChange]
  );

  return (
    <RefIDMultiPicker
      value={value?.options}
      onChange={onFilterChange}
      data={context.data}
      placeholder={t('geomap.frame-multi-selection-editor.placeholder-change-filter', 'Change filter')}
    />
  );
};
