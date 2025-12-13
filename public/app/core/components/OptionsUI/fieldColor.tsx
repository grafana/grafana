import { css } from '@emotion/css';
import { CSSProperties, FC } from 'react';

import {
  StandardEditorProps,
  FieldColorModeId,
  SelectableValue,
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
import { useStyles2, useTheme2, Field, Select, Combobox, type ComboboxOption } from '@grafana/ui';

import { ColorValueEditor } from './color';

type Props = StandardEditorProps<FieldColor | undefined, FieldColorConfigSettings>;

export const FieldColorEditor = ({ value, onChange, item, id }: Props) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const colorMode = getFieldColorMode(value?.mode);
  const availableOptions = item.settings?.byValueSupport
    ? fieldColorModeRegistry.list()
    : fieldColorModeRegistry.list().filter((m) => !m.isByValue);

  const filteredOptions = availableOptions.filter((option) => !option.excludeFromPicker);

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
    onChange({
      ...value,
      mode: newMode.value!,
    });
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
          <Select minMenuHeight={200} options={options} value={mode} onChange={onModeChange} inputId={id} />
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
