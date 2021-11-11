import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Field, Icon, PopoverContent, stylesFactory, Tooltip, useTheme2 } from '@grafana/ui';
import { getChildId } from '@grafana/ui/src/utils/children';
import { Space } from 'app/plugins/datasource/grafana-azure-monitor-datasource/components/Space';
import React from 'react';

interface EditorFieldProps {
  label: string;
  children: React.ReactElement;
  width?: number;
  optional?: boolean;
  tooltip?: PopoverContent;
}

const EditorField: React.FC<EditorFieldProps> = (props) => {
  const { label, optional, tooltip, children } = props;

  const theme = useTheme2();
  const styles = getStyles(theme, props);
  const childInputId = getChildId(children);

  const labelEl = (
    <>
      <label className={styles.label} htmlFor={childInputId}>
        {label}
        {optional && <span className={styles.optional}> - optional</span>}
        {tooltip && (
          <Tooltip placement="top" content={tooltip} theme="info">
            <Icon name="info-circle" size="sm" className={styles.icon} />
          </Tooltip>
        )}
      </label>
      <Space v={0.5} />
    </>
  );

  return (
    <div className={styles.root}>
      <Field className={styles.field} label={labelEl}>
        <div className={styles.child}>{children}</div>
      </Field>
    </div>
  );
};

export default EditorField;

const getStyles = stylesFactory((theme: GrafanaTheme2, props: EditorFieldProps) => {
  return {
    root: css({
      minWidth: theme.spacing(props.width ?? 0),
    }),
    label: css({
      fontSize: 12,
    }),
    optional: css({
      fontStyle: 'italic',
      color: theme.colors.text.secondary,
    }),
    field: css({
      marginBottom: 0, // GrafanaUI/Field has a bottom margin which we must remove
    }),

    // TODO: really poor hack to align the switch
    // Find a better solution to this
    child: css({
      display: 'flex',
      alignItems: 'center',
      minHeight: 30,
    }),
    icon: css({
      color: theme.colors.text.secondary,
      marginLeft: theme.spacing(1),
      ':hover': {
        color: theme.colors.text.primary,
      },
    }),
  };
});
