import React from 'react';
import { FieldConfigEditorProps, ColorFieldConfigSettings, GrafanaTheme } from '@grafana/data';
import { ColorPicker } from '../ColorPicker/ColorPicker';
import { getTheme, stylesFactory } from '../../themes';
import { Icon } from '../Icon/Icon';
import { css } from 'emotion';
import { Input } from '../Input/Input';

export const ColorValueEditor: React.FC<FieldConfigEditorProps<string, ColorFieldConfigSettings>> = ({
  value,
  onChange,
  item,
}) => {
  const { settings } = item;
  const theme = getTheme();
  const styles = getStyles(theme);
  let prefix: React.ReactNode = null;
  let suffix: React.ReactNode = null;
  if (value && settings.allowUndefined) {
    suffix = <Icon className={styles.trashIcon} name="trash-alt" onClick={() => onChange(undefined)} />;
  }

  prefix = (
    <div className={styles.inputPrefix}>
      <div className={styles.colorPicker}>
        <ColorPicker
          color={value || (item.defaultValue as string) || theme.colors.panelBg}
          onChange={onChange}
          enableNamedColors={!settings.disableNamedColors}
        />
      </div>
    </div>
  );

  return (
    <div>
      <Input
        type="text"
        value={value || settings.defaultText || 'Pick Color'}
        onBlur={(v: any) => {
          console.log('CLICK');
        }}
        prefix={prefix}
        suffix={suffix}
      />
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    colorPicker: css`
      padding: 0 ${theme.spacing.sm};
    `,
    inputPrefix: css`
      display: flex;
      align-items: center;
    `,
    trashIcon: css`
      color: ${theme.colors.textWeak};
      cursor: pointer;
      &:hover {
        color: ${theme.colors.text};
      }
    `,
  };
});
