import React, { CSSProperties, FC } from 'react';
import {
  FieldConfigEditorProps,
  FieldColorModeId,
  SelectableValue,
  FieldColor,
  fieldColorModeRegistry,
  FieldColorMode,
  GrafanaTheme,
  getColorForTheme,
} from '@grafana/data';
import { Select } from '../Select/Select';
import { ColorValueEditor } from './color';
import { useStyles, useTheme } from '../../themes/ThemeContext';
import { css } from 'emotion';

export const FieldColorEditor: React.FC<FieldConfigEditorProps<FieldColor | undefined, {}>> = ({
  value,
  onChange,
  item,
}) => {
  const theme = useTheme();
  const styles = useStyles(getStyles);

  const options = fieldColorModeRegistry.list().map(mode => {
    let suffix = mode.isByValue ? ' (by value)' : '';

    return {
      value: mode.id,
      label: `${mode.name}${suffix}`,
      description: mode.description,
      isContinuous: mode.isContinuous,
      isByValue: mode.isByValue,
      component: () => <FieldColorModeViz mode={mode} theme={theme} />,
    };
  });

  const onModeChange = (newMode: SelectableValue<string>) => {
    onChange({
      mode: newMode.value! as FieldColorModeId,
    });
  };

  const onColorChange = (color?: string) => {
    onChange({
      mode,
      fixedColor: color,
    });
  };

  const mode = value?.mode ?? FieldColorModeId.Thresholds;

  if (mode === FieldColorModeId.Fixed) {
    return (
      <div className={styles.group}>
        <Select minMenuHeight={200} options={options} value={mode} onChange={onModeChange} className={styles.select} />
        <ColorValueEditor value={value?.fixedColor} onChange={onColorChange} />
      </div>
    );
  }

  return <Select minMenuHeight={200} options={options} value={mode} onChange={onModeChange} />;
};

interface ModeProps {
  mode: FieldColorMode;
  theme: GrafanaTheme;
}

const FieldColorModeViz: FC<ModeProps> = ({ mode, theme }) => {
  if (!mode.colors) {
    return null;
  }

  const colors = mode.colors.map(item => getColorForTheme(item, theme));
  const style: CSSProperties = {
    height: '8px',
    width: '100%',
    margin: '2px 0',
    borderRadius: '3px',
    opacity: 1,
  };

  if (mode.isContinuous) {
    style.background = `linear-gradient(90deg, ${colors.join(',')})`;
  } else {
    let gradient = '';
    let lastColor = '';

    for (let i = 0; i < colors.length; i++) {
      const color = colors[i];
      if (gradient === '') {
        gradient = `linear-gradient(90deg, ${color} 0%`;
      } else {
        const valuePercent = i / (colors.length - 1);
        const pos = valuePercent * 100;
        gradient += `, ${lastColor} ${pos}%, ${color} ${pos}%`;
      }
      lastColor = color;
    }
    style.background = gradient;
  }

  return <div style={style} />;
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    group: css`
      display: flex;
    `,
    select: css`
      margin-right: 8px;
      flex-grow: 1;
    `,
  };
};
