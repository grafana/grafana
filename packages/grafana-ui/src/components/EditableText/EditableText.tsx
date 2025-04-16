import { css } from '@emotion/css';
import { forwardRef } from 'react';

import { GrafanaTheme2, ThemeTypographyVariantTypes } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { Input, Props as InputProps } from '../Input/Input';
import { Text, TextProps } from '../Text/Text';
import { customWeight, customVariant } from '../Text/utils';

type PickedInputProps = Pick<InputProps, 'width'>;
type PickedTextProps = Pick<TextProps, 'element' | 'variant' | 'weight'>;

interface BaseProps {
  isEditing: boolean;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

type EditableTextProps = BaseProps & PickedInputProps & PickedTextProps;

export const EditableText = forwardRef<HTMLDivElement, EditableTextProps>(
  ({ isEditing, value, onChange, width, element, variant, weight }, ref) => {
    const styles = useStyles2(getEditableTextStyles, element, variant, weight);

    return (
      <div ref={ref} data-testid="EditableText">
        {isEditing ? (
          <div className={styles.inputWrapper}>
            <Input data-testid="editable-text-input" onChange={onChange} value={value} width={width} />
          </div>
        ) : (
          <div className={styles.textWrapper}>
            <Text element={element} variant={variant} weight={weight}>
              {value}
            </Text>
          </div>
        )}
      </div>
    );
  }
);

EditableText.displayName = 'EditableText';

const getEditableTextStyles = (
  theme: GrafanaTheme2,
  element?: PickedTextProps['element'],
  variant?: keyof ThemeTypographyVariantTypes,
  weight?: PickedTextProps['weight']
) => {
  return {
    inputWrapper: css({
      input: {
        ...customVariant(theme, element, variant),
        ...(variant && {
          ...theme.typography[variant],
        }),
        ...(weight && {
          fontWeight: customWeight(weight, theme),
        }),
      },
    }),
    textWrapper: css({
      display: 'flex',
      padding: theme.spacing(1),
      border: '1px solid transparent',
      alignItems: 'center',
      height: theme.spacing(theme.components.height.md),
    }),
  };
};
