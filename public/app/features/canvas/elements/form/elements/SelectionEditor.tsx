import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Field, Input, useStyles2 } from '@grafana/ui';
import { ParamsEditor } from 'app/plugins/panel/canvas/editor/element/ParamsEditor';

interface SelectionEditorProps {
  title: string;
  options: Array<[string, string]>;
  onParamsChange: (v: Array<[string, string]>) => void;
  onTitleChange: (v: string) => void;
}

export const SelectionEditor = ({ title, options, onParamsChange, onTitleChange }: SelectionEditorProps) => {
  const styles = useStyles2(getStyles);

  return (
    <>
      <Field label="Selection item title">
        <Input defaultValue={title} onBlur={(e) => onTitleChange(e.currentTarget.value)} />
      </Field>
      <Field label="Parameters" className={styles.container}>
        <ParamsEditor value={options ?? []} onChange={onParamsChange} />
      </Field>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    marginTop: theme.spacing(1.5),
  }),
});
