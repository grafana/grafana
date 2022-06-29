import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2, useStyles2, ColorPicker } from '@grafana/ui';
import { ColorSwatch } from '@grafana/ui/src/components/ColorPicker/ColorSwatch';

/**
 * @alpha
 * */
export interface ColorValueEditorProps {
  value?: string;
  onChange: (value: string) => void;
}

/**
 * @alpha
 * */
export const ColorValueEditor: React.FC<ColorValueEditorProps> = ({ value, onChange }) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  return (
    <ColorPicker color={value ?? ''} onChange={onChange} enableNamedColors={true}>
      {({ ref, showColorPicker, hideColorPicker }) => {
        return (
          <div className={styles.spot}>
            <div className={styles.colorPicker}>
              <ColorSwatch
                ref={ref}
                onClick={showColorPicker}
                onMouseLeave={hideColorPicker}
                color={value ? theme.visualization.getColorByName(value) : theme.components.input.borderColor}
              />
            </div>
          </div>
        );
      }}
    </ColorPicker>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    spot: css`
      color: ${theme.colors.text};
      background: ${theme.components.input.background};
      padding: 3px;
      height: ${theme.v1.spacing.formInputHeight}px;
      border: 1px solid ${theme.components.input.borderColor};
      display: flex;
      flex-direction: row;
      align-items: center;
      &:hover {
        border: 1px solid ${theme.components.input.borderHover};
      }
    `,
    colorPicker: css`
      padding: 0 ${theme.spacing(1)};
    `,
    colorText: css`
      cursor: pointer;
      flex-grow: 1;
    `,
    trashIcon: css`
      cursor: pointer;
      color: ${theme.colors.text.secondary};
      &:hover {
        color: ${theme.colors.text};
      }
    `,
  };
};
