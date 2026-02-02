import { css } from '@emotion/css';
import { FC, memo } from 'react';

// BMC Code : Accessibility Change ( Next 2 lines )
import { GrafanaTheme2 } from '@grafana/data';
import { Checkbox, Field, stylesFactory, useTheme2 } from '@grafana/ui';

interface Props {
  checked?: boolean;
  onClick: any;
  editable?: boolean;
  // BMC Code : Accessibility Change ( Next 3 lines )
  id?: string;
  label?: string;
  description?: string;
}

export const SearchCheckbox: FC<Props> = memo(
  ({ onClick, checked = false, editable = false, id = '', label = '', description = '' }) => {
    // BMC Code : Accessibility Change starts here.
    // using theme for label stying and passing to style function to create class in next 2 lines.
    const theme = useTheme2();
    const styles = getStyles(theme);

    // Added onCheckboxKeyDown function to trigger checkbox on space/enter press.
    const onCheckboxKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.stopPropagation();
        event.preventDefault();

        onClick(event);
      }
    };
    // BMC Code : Accessibility Change ends here.

    return editable ? (
      <div onClick={onClick} className={styles.wrapper}>
        {
          // BMC Code : Accessibility Change starts here.
          // Changed existing checkbox implementation. Added Field component for labels and wrapped checkbox inside it.
        }
        <Field
          style={{
            display: 'flex',
            flexDirection: 'row-reverse',
            alignItems: 'center',
            marginBottom: '0',
          }}
          label={
            <label htmlFor={id}>
              <span
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  marginLeft: '12px',
                  cursor: 'pointer',
                }}
                // BMC Code : Accessibility Change (Next 3 Lines)
                role="checkbox"
                aria-labelledby={`Select ${label}`}
                aria-checked={checked}
              >
                <span className={styles.label}>{label}</span>
                <span className={styles.description}>{description}</span>
              </span>
            </label>
          }
        >
          {
            // Added onCheckboxKeyDown event to handle keybaord press. Passed label, id and description for tagging with proper label
          }
          <Checkbox onKeyDown={(event) => onCheckboxKeyDown(event)} name={label} id={id} value={checked} />
        </Field>
        {
          // BMC Code : Accessibility Change ends here.
        }
      </div>
    ) : null;
  }
);
SearchCheckbox.displayName = 'SearchCheckbox';

// BMC Code : Accessibility Change ( Next line )
const getStyles = stylesFactory((theme: GrafanaTheme2) => ({
  // Vertically align absolutely positioned checkbox element
  wrapper: css`
    display: flex;
    height: 21px;
    margin-right: 12px;
    & > label {
      height: 100%;
    }
  `,
  // BMC Code : Accessibility Change starts here.
  // Accessibility Change | Added label and description class for styling
  label: css`
    margin-right: 10px;
  `,
  description: css`
    color: ${theme.colors.text.maxContrast};
    font-size: ${theme.typography.size.xs};
    line-height: ${theme.typography.bodySmall.lineHeight};
    max-width: fit-content;
    position: relative;
  `,
  // BMC Code : Accessibility Change ends here.
}));
