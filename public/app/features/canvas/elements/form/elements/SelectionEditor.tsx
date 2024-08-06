import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Field, useStyles2 } from '@grafana/ui';
import { ParamsEditor } from 'app/plugins/panel/canvas/editor/element/ParamsEditor';

interface SelectionEditorProps {
  options: Array<[string, string]>;
  onChange: (v: Array<[string, string]>) => void;
}

export const SelectionEditor = ({ options, onChange }: SelectionEditorProps) => {
  const styles = useStyles2(getStyles);

  return (
    <Field label="Selection parameters" className={styles.container}>
      <ParamsEditor value={options ?? []} onChange={onChange} />
    </Field>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    marginTop: theme.spacing(1.5),
  }),
});
