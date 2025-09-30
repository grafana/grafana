import { StandardEditorProps } from '@grafana/data';
import { Stack } from '@grafana/ui';


export interface AnnotationEditorOptions {
}

type Props = StandardEditorProps<string, AnnotationEditorOptions>;

/** This will return the item UID */
export const AnnotationEditor = ({ value, onChange, item }: Props) => {
  const {} = item?.settings ?? {};

  return (
    <Stack direction="column">Hello annotations</Stack>
  )
};
