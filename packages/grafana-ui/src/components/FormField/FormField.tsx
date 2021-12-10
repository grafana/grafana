import React, { InputHTMLAttributes, FunctionComponent, ReactNode } from 'react';
import { css, cx } from '@emotion/css';
import { InlineFormLabel } from '../FormLabel/FormLabel';

import { PopoverContent } from '../Tooltip/Tooltip';
// TODO: move to grafana/ui
const LibraryCredential = ({ credentialName, children }: { credentialName: string; children: ReactNode }) => {
  return (
    <>
      <span data-lib-credential={credentialName}>{children}</span>
    </>
  );
};
export interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  tooltip?: PopoverContent;
  labelWidth?: number;
  // If null no width will be specified not even default one
  inputWidth?: number | null;
  inputEl?: React.ReactNode;
  libCredentialName?: string;
}

const defaultProps = {
  labelWidth: 6,
  inputWidth: 12,
};

/**
 * Default form field including label used in Grafana UI. Default input element is simple <input />. You can also pass
 * custom inputEl if required in which case inputWidth and inputProps are ignored.
 */
export const FormField: FunctionComponent<Props> = ({
  label,
  tooltip,
  labelWidth,
  inputWidth,
  inputEl,
  className,
  libCredentialName,
  ...inputProps
}) => {
  const styles = getStyles();
  console.log('HEY?', inputEl, libCredentialName);
  return (
    <div className={cx(styles.formField, className)}>
      <InlineFormLabel width={labelWidth} tooltip={tooltip}>
        {label}
      </InlineFormLabel>
      <LibraryCredential credentialName={libCredentialName || ''}>
        {inputEl || (
          <input type="text" className={`gf-form-input ${inputWidth ? `width-${inputWidth}` : ''}`} {...inputProps} />
        )}
      </LibraryCredential>
    </div>
  );
};

FormField.displayName = 'FormField';
FormField.defaultProps = defaultProps;

const getStyles = () => {
  return {
    formField: css`
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      text-align: left;
      position: relative;
    `,
  };
};
