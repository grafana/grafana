import React from 'react';
import {
  FieldConfigEditorProps,
  ColorFieldConfigSettings,
  GrafanaTheme,
  getColorFromHexRgbOrName,
} from '@grafana/data';
import { ColorPicker } from '../ColorPicker/ColorPicker';
import { getTheme, stylesFactory } from '../../themes';
import { Icon } from '../Icon/Icon';
import { css } from 'emotion';
import { ColorPickerTrigger } from '../ColorPicker/ColorPickerTrigger';

export const ColorValueEditor: React.FC<FieldConfigEditorProps<string, ColorFieldConfigSettings>> = ({
  value,
  onChange,
  item,
}) => {
  const { settings } = item;
  const theme = getTheme();
  const styles = getStyles(theme);

  const color = value || (item.defaultValue as string) || theme.colors.panelBg;

  return (
    <ColorPicker color={color} onChange={onChange} enableNamedColors={!settings?.disableNamedColors}>
      {({ ref, showColorPicker, hideColorPicker }) => {
        return (
          <div className={styles.spot} onBlur={hideColorPicker}>
            <div className={styles.colorPicker}>
              <ColorPickerTrigger
                ref={ref}
                onClick={showColorPicker}
                onMouseLeave={hideColorPicker}
                color={getColorFromHexRgbOrName(color, theme.type)}
              />
            </div>
            <div className={styles.colorText} onClick={showColorPicker}>
              {value ?? settings?.textWhenUndefined ?? 'Pick Color'}
            </div>
            {value && settings?.allowUndefined && (
              <Icon className={styles.trashIcon} name="trash-alt" onClick={() => onChange(undefined)} />
            )}
          </div>
        );
      }}
    </ColorPicker>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    spot: css`
      color: ${theme.colors.text};
      background: ${theme.colors.formInputBg};
      padding: 3px;
      border: 1px solid ${theme.colors.formInputBorder};
      display: flex;
      flex-direction: row;
      align-items: center;
      &:hover {
        border: 1px solid ${theme.colors.formInputBorderHover};
      }
    `,
    colorPicker: css`
      padding: 0 ${theme.spacing.sm};
    `,
    colorText: css`
      cursor: pointer;
      flex-grow: 1;
    `,
    trashIcon: css`
      cursor: pointer;
      color: ${theme.colors.textWeak};
      &:hover {
        color: ${theme.colors.text};
      }
    `,
  };
});
