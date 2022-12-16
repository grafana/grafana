import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

export function getFormElementStyles(theme: GrafanaTheme2) {
  return css`
    input,
    button,
    select,
    textarea {
      font-size: ${theme.typography.body.fontSize};
      font-weight: ${theme.typography.body.fontWeight};
      line-height: ${theme.typography.body.lineHeight};
    }
    input,
    button,
    select,
    textarea {
      font-family: ${theme.typography.body.fontFamily};
    }

    input,
    select {
      background-color: ${theme.components.input.background};
      color: ${theme.components.input.text};
      border: none;
      box-shadow: none;
    }

    textarea {
      height: auto;
    }

    // Reset width of input images, buttons, radios, checkboxes
    input[type='file'],
    input[type='image'],
    input[type='submit'],
    input[type='reset'],
    input[type='button'],
    input[type='radio'],
    input[type='checkbox'] {
      width: auto; // Override of generic input selector
    }
  `;
}
