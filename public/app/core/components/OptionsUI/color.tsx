import { css } from '@emotion/css';
import { useId } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useTheme2, useStyles2, ColorPicker, IconButton } from '@grafana/ui';
import { ColorSwatch } from '@grafana/ui/internal';

export interface ColorValueEditorSettings {
  placeholder?: string;
  /** defaults to true */
  enableNamedColors?: boolean;
  /** defaults to false */
  isClearable?: boolean;
}

interface Props {
  id?: string;
  'aria-describedby'?: string;
  value?: string;
  onChange: (value: string | undefined) => void;
  settings?: ColorValueEditorSettings;

  // Will show placeholder or details
  details?: boolean;
}

/**
 * @alpha
 * */
export const ColorValueEditor = ({
  value,
  settings,
  onChange,
  details,
  id,
  'aria-describedby': ariaDescribedBy,
}: Props) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const generatedId = useId();
  const swatchId = id ?? generatedId;
  const a11yNameId = `${swatchId}-a11y-name`;
  const placeholder = settings?.placeholder ?? 'Select color';

  return (
    <ColorPicker color={value ?? ''} onChange={onChange} enableNamedColors={settings?.enableNamedColors !== false}>
      {({ ref, showColorPicker, hideColorPicker }) => {
        return (
          <div className={styles.spot}>
            <div className={styles.colorPicker}>
              <ColorSwatch
                ref={ref}
                id={swatchId}
                aria-describedby={ariaDescribedBy}
                aria-labelledby={details ? a11yNameId : undefined}
                onClick={showColorPicker}
                onMouseLeave={hideColorPicker}
                color={value ? theme.visualization.getColorByName(value) : theme.components.input.borderColor}
              />
            </div>
            {details && (
              <>
                {value ? (
                  <span className={styles.colorText}>
                    <label htmlFor={swatchId}>{value}</label>
                  </span>
                ) : (
                  <span className={styles.placeholderText}>
                    <label htmlFor={swatchId}>{placeholder}</label>
                  </span>
                )}
                <span className="sr-only" id={a11yNameId}>
                  {value
                    ? t('options-ui.color.swatch-aria-label', 'Pick a color, current selection {{color}}', {
                        color: value,
                      })
                    : t('options-ui.color.swatch-placeholder-aria-label', 'Pick a color, {{placeholder}}', {
                        placeholder,
                      })}
                </span>
                {settings?.isClearable && value && (
                  <IconButton
                    name="times"
                    onClick={() => onChange(undefined)}
                    tooltip={t('options-ui.color.clear-tooltip', 'Clear settings')}
                  />
                )}
              </>
            )}
          </div>
        );
      }}
    </ColorPicker>
  );
};

const nameArea = {
  flexGrow: 2,
  alignSelf: 'stretch',
  display: 'flex',
  '& label': {
    flexGrow: 1,
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
  },
} as const;

const getStyles = (theme: GrafanaTheme2) => {
  return {
    spot: css({
      cursor: 'pointer',
      color: theme.colors.text.primary,
      background: theme.components.input.background,
      borderRadius: theme.shape.radius.default,
      padding: '3px',
      height: theme.v1.spacing.formInputHeight,
      border: `1px solid ${theme.components.input.borderColor}`,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      alignContent: 'flex-end',
      '&:hover': {
        border: `1px solid ${theme.components.input.borderHover}`,
      },
    }),
    colorPicker: css({
      padding: `0 ${theme.spacing(1)}`,
    }),
    colorText: css(nameArea),
    placeholderText: css({
      ...nameArea,
      color: theme.colors.text.secondary,
    }),
  };
};
