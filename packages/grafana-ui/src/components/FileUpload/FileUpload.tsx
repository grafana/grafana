import { css, cx } from '@emotion/css';
import React, { FormEvent, useCallback, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes';
import { getFocusStyles } from '../../themes/mixins';
import { ComponentSize } from '../../types/size';
import { trimFileName } from '../../utils/file';
import { getButtonStyles } from '../Button';
import { Icon } from '../index';

export interface Props {
  /** Callback function to handle uploaded file  */
  onFileUpload: (event: FormEvent<HTMLInputElement>) => void;
  /** Accepted file extensions */
  accept?: string;
  /** Overwrite or add to style */
  className?: string;
  /** Button size */
  size?: ComponentSize;
  /** Show the file name */
  showFileName?: boolean;
}

export const FileUpload = ({
  onFileUpload,
  className,
  children = 'Upload file',
  accept = '*',
  size = 'md',
}: React.PropsWithChildren<Props>) => {
  const style = useStyles2(getStyles(size));
  const [fileName, setFileName] = useState('');
  const id = uuidv4();

  const onChange = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      const file = event.currentTarget?.files?.[0];
      if (file) {
        setFileName(file.name ?? '');
      }
      onFileUpload(event);
    },
    [onFileUpload]
  );

  return (
    <>
      <input
        type="file"
        id={id}
        className={style.fileUpload}
        onChange={onChange}
        multiple={false}
        accept={accept}
        data-testid={selectors.components.FileUpload.inputField}
      />
      <label htmlFor={id} className={cx(style.labelWrapper, className)}>
        <Icon name="upload" className={style.icon} />
        {children}
      </label>

      {fileName && (
        <span
          aria-label="File name"
          className={style.fileName}
          data-testid={selectors.components.FileUpload.fileNameSpan}
        >
          {trimFileName(fileName)}
        </span>
      )}
    </>
  );
};

const getStyles = (size: ComponentSize) => (theme: GrafanaTheme2) => {
  const buttonStyles = getButtonStyles({ theme, variant: 'primary', size, iconOnly: false });
  const focusStyle = getFocusStyles(theme);

  return {
    fileUpload: css({
      height: '0.1px',
      opacity: '0',
      overflow: 'hidden',
      position: 'absolute',
      width: '0.1px',
      zIndex: -1,
      '&:focus + label': focusStyle,
      '&:focus-visible + label': focusStyle,
    }),
    labelWrapper: buttonStyles.button,
    icon: buttonStyles.icon,
    fileName: css({
      marginLeft: theme.spacing(0.5),
    }),
  };
};
