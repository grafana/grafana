import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Field, Input, useStyles2 } from '@grafana/ui';
import { ParamsEditor } from 'app/plugins/panel/canvas/editor/element/ParamsEditor';

interface Props {
  title: string;
  options: Array<[string, string]>;
  onParamsChange: (v: Array<[string, string]>) => void;
  onTitleChange: (v: string) => void;
}

export const RadioListEditor = ({ title, options, onParamsChange, onTitleChange }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <>
      <Field label="Checkbox item title">
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
