import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useTheme2, useStyles2, ColorPicker, IconButton, clearButtonStyles } from '@grafana/ui';
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
  const resetButtonStyles = useStyles2(clearButtonStyles);

  return (
    <ColorPicker color={value ?? ''} onChange={onChange} enableNamedColors={settings?.enableNamedColors !== false}>
      {({ ref, showColorPicker, hideColorPicker }) => {
        return (
          <div className={styles.spot}>
            <div className={styles.colorPicker}>
              <ColorSwatch
                ref={ref}
                id={id}
                aria-describedby={ariaDescribedBy}
                onClick={showColorPicker}
                onMouseLeave={hideColorPicker}
                color={value ? theme.visualization.getColorByName(value) : theme.components.input.borderColor}
              />
            </div>
            {details && (
              <>
                {value ? (
                  <button type="button" className={cx(resetButtonStyles, styles.colorText)} onClick={showColorPicker}>
                    {value}
                  </button>
                ) : (
                  <button className={cx(resetButtonStyles, styles.placeholderText)} onClick={showColorPicker}>
                    {settings?.placeholder ?? 'Select color'}
                  </button>
                )}
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
    colorText: css({
      flexGrow: 2,
      textAlign: 'left',
    }),
    placeholderText: css({
      flexGrow: 2,
      color: theme.colors.text.secondary,
      textAlign: 'left',
    }),
  };
};
