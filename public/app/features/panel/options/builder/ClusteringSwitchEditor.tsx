import { StandardEditorProps } from '@grafana/data';
import { Switch } from '@grafana/ui';

const DEFAULT_CLUSTERING_ANNOTATION_SPACING = 24;

export const ClusteringSwitchEditor = ({ onChange, value, id }: StandardEditorProps<number>) => (
  <Switch
    id={id}
    value={Boolean(value && value > 0)}
    onChange={(event) => onChange(event?.currentTarget.checked ? DEFAULT_CLUSTERING_ANNOTATION_SPACING : 0)}
  />
);
