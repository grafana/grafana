import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2, useStyles2, ColorPicker, IconButton } from '@grafana/ui';
import { ColorSwatch } from '@grafana/ui/internal';

import { t } from '../../internationalization';

export interface ColorValueEditorSettings {
  placeholder?: string;
  /** defaults to true */
  enableNamedColors?: boolean;
  /** defaults to false */
  isClearable?: boolean;
}

interface Props {
  value?: string;
  onChange: (value: string | undefined) => void;
  settings?: ColorValueEditorSettings;

  // Will show placeholder or details
  details?: boolean;
}

/**
 * @alpha
 * */
export const ColorValueEditor = ({ value, settings, onChange, details }: Props) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  return (
    <ColorPicker color={value ?? ''} onChange={onChange} enableNamedColors={settings?.enableNamedColors !== false}>
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
            {details && (
              <>
                {value ? (
                  // TODO: fix keyboard a11y
                  // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                  <span className={styles.colorText} onClick={showColorPicker}>
                    {value}
                  </span>
                ) : (
                  // TODO: fix keyboard a11y
                  // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                  <span className={styles.placeholderText} onClick={showColorPicker}>
                    {settings?.placeholder ?? 'Select color'}
                  </span>
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
    }),
    placeholderText: css({
      flexGrow: 2,
      color: theme.colors.text.secondary,
    }),
  };
};
