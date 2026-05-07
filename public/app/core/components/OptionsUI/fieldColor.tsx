import { css } from '@emotion/css';
import { type CSSProperties, type FC } from 'react';

import {
  type StandardEditorProps,
  FieldColorModeId,
  type SelectableValue,
  type FieldColor,
  fieldColorModeRegistry,
  type FieldColorMode,
  type GrafanaTheme2,
  type FieldColorConfigSettings,
  type FieldColorSeriesByMode,
  getFieldColorMode,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useStyles2, useTheme2, Field, RadioButtonGroup, Select, Stack } from '@grafana/ui';

import { ColorValueEditor } from './color';

const GRADIENT_DEFAULT_FROM = '#73BF69';
const GRADIENT_DEFAULT_TO = '#F2495C';

type Props = StandardEditorProps<FieldColor | undefined, FieldColorConfigSettings>;

export const FieldColorEditor = ({ value, onChange, item, id }: Props) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const colorMode = getFieldColorMode(value?.mode);
  const availableOptions = item.settings?.byValueSupport
    ? fieldColorModeRegistry.list()
    : fieldColorModeRegistry.list().filter((m) => !m.isByValue);

  const filteredOptions = availableOptions.filter(
    (option) =>
      !option.excludeFromPicker &&
      (option.id !== FieldColorModeId.PaletteColorblind || config.featureToggles.enableColorblindSafePanelOptions) &&
      (option.id !== FieldColorModeId.Gradient ||
        (item.settings?.gradientSupport && config.featureToggles.pieChartGradientColorScheme))
  );

  const options: Array<SelectableValue<string>> = [];
  // collect any grouped options in this map
  // this allows us to easily push to the child array without having to rescan the options array
  // it also allows us to maintain group position in the order they're first encountered
  const groupMap = new Map<string, Array<SelectableValue<string>>>();

  for (const option of filteredOptions) {
    const suffix = option.isByValue ? ' (by value)' : '';

    const groupName = option.group;
    const selectOption = {
      value: option.id,
      label: `${option.name}${suffix}`,
      description: option.description,
      component() {
        return <FieldColorModeViz mode={option} theme={theme} />;
      },
    };

    if (groupName) {
      let group = groupMap.get(groupName);
      if (!group) {
        group = [];
        groupMap.set(groupName, group);
        options.push({ label: groupName, options: group });
      }
      group.push(selectOption);
    } else {
      options.push(selectOption);
    }
  }

  const onModeChange = (newMode: SelectableValue<string>) => {
    const update: FieldColor = { ...value, mode: newMode.value! };
    // Seed gradient defaults so the pickers are never empty when first selected.
    if (newMode.value === FieldColorModeId.Gradient) {
      update.fixedColor = value?.fixedColor ?? GRADIENT_DEFAULT_FROM;
      update.gradientColorTo = value?.gradientColorTo ?? GRADIENT_DEFAULT_TO;
    }
    onChange(update);
  };

  const onColorChange = (color?: string) => {
    onChange({
      ...value,
      mode,
      fixedColor: color,
    });
  };

  const onGradientColorToChange = (color?: string) => {
    onChange({
      ...value,
      mode,
      gradientColorTo: color,
    });
  };

  const onSeriesModeChange = (seriesBy?: FieldColorSeriesByMode) => {
    onChange({
      ...value,
      mode,
      seriesBy,
    });
  };

  const mode = value?.mode ?? FieldColorModeId.Thresholds;

  if (mode === FieldColorModeId.Fixed || mode === FieldColorModeId.Shades) {
    return (
      <div className={styles.group}>
        <Select
          minMenuHeight={200}
          options={options}
          value={mode}
          onChange={onModeChange}
          className={styles.select}
          inputId={id}
        />
        <ColorValueEditor value={value?.fixedColor} onChange={onColorChange} />
      </div>
    );
  }

  if (mode === FieldColorModeId.Gradient) {
    return (
      <div className={styles.group}>
        <Select
          minMenuHeight={200}
          options={options}
          value={mode}
          onChange={onModeChange}
          className={styles.select}
          inputId={id}
        />
        <Stack gap={0.5}>
          <ColorValueEditor value={value?.fixedColor ?? GRADIENT_DEFAULT_FROM} onChange={onColorChange} />
          <ColorValueEditor value={value?.gradientColorTo ?? GRADIENT_DEFAULT_TO} onChange={onGradientColorToChange} />
        </Stack>
      </div>
    );
  }

  if (item.settings?.bySeriesSupport && colorMode.isByValue) {
    const seriesModes: Array<SelectableValue<FieldColorSeriesByMode>> = [
      { label: 'Last', value: 'last' },
      { label: 'Min', value: 'min' },
      { label: 'Max', value: 'max' },
    ];

    return (
      <>
        <div style={{ marginBottom: theme.spacing(2) }}>
          <Select minMenuHeight={200} options={options} value={mode} onChange={onModeChange} inputId={id} />
        </div>
        <Field label={t('options-ui.field-color.color-by-label', 'Color series by')}>
          <RadioButtonGroup value={value?.seriesBy ?? 'last'} options={seriesModes} onChange={onSeriesModeChange} />
        </Field>
      </>
    );
  }

  return <Select minMenuHeight={200} options={options} value={mode} onChange={onModeChange} inputId={id} />;
};

interface ModeProps {
  mode: FieldColorMode;
  theme: GrafanaTheme2;
}

const FieldColorModeViz: FC<ModeProps> = ({ mode, theme }) => {
  if (!mode.getColors) {
    return null;
  }

  const colors = mode.getColors(theme).map(theme.visualization.getColorByName);
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
        const valuePercent = i / colors.length;
        const pos = valuePercent * 100;
        gradient += `, ${lastColor} ${pos}%, ${color} ${pos}%`;
      }
      lastColor = color;
    }
    style.background = gradient;
  }

  return <div style={style} />;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    group: css({
      display: 'flex',
    }),
    select: css({
      marginRight: theme.spacing(1),
      flexGrow: 1,
    }),
  };
};
