import React, { useCallback } from 'react';
import {
  FieldConfigEditorProps,
  ColorFieldConfigSettings,
  GrafanaTheme,
  getColorFromHexRgbOrName,
  FieldColor,
} from '@grafana/data';
import { ColorPicker } from '../ColorPicker/ColorPicker';
import { getTheme, stylesFactory } from '../../themes';
import { Icon } from '../Icon/Icon';
import { css } from 'emotion';
import { ColorPickerTrigger } from '../ColorPicker/ColorPickerTrigger';

// Supporting FixedColor only currently
export const ColorValueEditor: React.FC<FieldConfigEditorProps<FieldColor, ColorFieldConfigSettings>> = ({
  value,
  onChange,
  item,
}) => {
  const { settings } = item;
  const theme = getTheme();
  const styles = getStyles(theme);

  const color = value?.fixedColor || item.defaultValue?.fixedColor;

  const onValueChange = useCallback(
    color => {
      onChange({ ...value, fixedColor: color });
    },
    [value]
  );

  return (
    <ColorPicker color={color || ''} onChange={onValueChange} enableNamedColors={!settings?.disableNamedColors}>
      {({ ref, showColorPicker, hideColorPicker }) => {
        return (
          <div className={styles.spot} onBlur={hideColorPicker}>
            <div className={styles.colorPicker}>
              <ColorPickerTrigger
                ref={ref}
                onClick={showColorPicker}
                onMouseLeave={hideColorPicker}
                color={color ? getColorFromHexRgbOrName(color, theme.type) : theme.colors.formInputBorder}
              />
            </div>
            <div className={styles.colorText} onClick={showColorPicker}>
              {color ?? settings?.textWhenUndefined ?? 'Pick Color'}
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
