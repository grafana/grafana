import { css } from '@emotion/css';
import { CSSProperties, FC } from 'react';

import {
  StandardEditorProps,
  FieldColorModeId,
  FieldColor,
  fieldColorModeRegistry,
  FieldColorMode,
  GrafanaTheme2,
  FieldColorConfigSettings,
  FieldColorSeriesByMode,
  getFieldColorMode,
  fieldReducers,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2, useTheme2, Field, Combobox, type ComboboxOption } from '@grafana/ui';

import { ColorValueEditor } from './color';

type Props = StandardEditorProps<FieldColor | undefined, FieldColorConfigSettings>;

export const FieldColorEditor = ({ value, onChange, item, id }: Props) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const colorMode = getFieldColorMode(value?.mode);
  const availableOptions = item.settings?.byValueSupport
    ? fieldColorModeRegistry.list()
    : fieldColorModeRegistry.list().filter((m) => !m.isByValue);

  const options = availableOptions
    .filter((mode) => !mode.excludeFromPicker)
    .map((mode) => {
      let suffix = mode.isByValue ? ' (by value)' : '';

      return {
        value: mode.id,
        label: `${mode.name}${suffix}`,
        description: mode.description,
        isContinuous: mode.isContinuous,
        isByValue: mode.isByValue,
        component() {
          return <FieldColorModeViz mode={mode} theme={theme} />;
        },
      };
    });

  const onModeChange = (option: ComboboxOption<string> | null) => {
    if (option?.value) {
      onChange({
        ...value,
        mode: option.value,
      });
    }
  };

  const onColorChange = (color?: string) => {
    onChange({
      ...value,
      mode,
      fixedColor: color,
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
        <Combobox options={options} value={mode} onChange={onModeChange} width="auto" minWidth={16} id={id} />
        <ColorValueEditor value={value?.fixedColor} onChange={onColorChange} />
      </div>
    );
  }

  if (item.settings?.bySeriesSupport && colorMode.isByValue) {
    // Get all available reducers and filter to those that make sense for color calculation
    const allReducers = fieldReducers.list();
    const seriesModes: Array<ComboboxOption<string>> = allReducers
      .filter((reducer) => {
        // Exclude reducers that don't preserve units or don't make sense for color calculation
        return (
          reducer.preservesUnits &&
          reducer.id !== 'allIsZero' &&
          reducer.id !== 'allIsNull' &&
          reducer.id !== 'allValues' &&
          reducer.id !== 'uniqueValues'
        );
      })
      .map((reducer) => ({
        label: reducer.name,
        value: reducer.id,
        description: reducer.description,
      }));

    return (
      <>
        <div style={{ marginBottom: theme.spacing(2) }}>
          <Combobox options={options} value={mode} onChange={onModeChange} id={id} />
        </div>
        <Field label={t('options-ui.field-color.color-by-label', 'Color series by')} noMargin>
          <Combobox
            options={seriesModes}
            value={value?.seriesBy ?? 'last'}
            onChange={(option) => {
              const selectedValue = option?.value;
              if (selectedValue) {
                // Type assertion is safe here because we filter to only valid reducer IDs
                // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                onSeriesModeChange(selectedValue as FieldColorSeriesByMode);
              }
            }}
            id={id}
          />
        </Field>
      </>
    );
  }

  return <Combobox options={options} value={mode} onChange={onModeChange} id={id} />;
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
