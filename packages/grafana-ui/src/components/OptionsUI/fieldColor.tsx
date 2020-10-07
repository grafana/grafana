import React from 'react';
import {
  FieldConfigEditorProps,
  FieldColorModeId,
  SelectableValue,
  FieldColor,
  fieldColorModeRegistry,
  GrafanaTheme,
} from '@grafana/data';
import { Select } from '../Select/Select';
import { ColorValueEditor } from './color';
import { useStyles } from '../../themes/ThemeContext';
import { css } from 'emotion';

export const FieldColorEditor: React.FC<FieldConfigEditorProps<FieldColor | undefined, {}>> = ({
  value,
  onChange,
  item,
}) => {
  const styles = useStyles(getStyles);

  const options = fieldColorModeRegistry.list().map(mode => {
    return {
      value: mode.id,
      label: mode.name,
      description: mode.description,
      isContinuous: mode.isContinuous,
      isByValue: mode.isByValue,
    };
  });

  const groups = [
    options.find(item => item.value === FieldColorModeId.Fixed)!,
    options.find(item => item.value === FieldColorModeId.Thresholds)!,
    {
      label: 'Color by series',
      options: options.filter(item => item.isByValue === false),
      expanded: false,
    },
    {
      label: 'Color by value',
      options: options.filter(item => item.isByValue === true),
      expanded: false,
    },
  ];

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
        <Select options={groups} value={mode} onChange={onModeChange} className={styles.select} />
        <ColorValueEditor value={value?.fixedColor} onChange={onColorChange} />
      </div>
    );
  }

  return <Select options={groups} value={mode} onChange={onModeChange} />;
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
