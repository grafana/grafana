import { css, cx } from '@emotion/css';
import { lazy, Suspense, type ReactNode } from 'react';
import type { Accept, DropzoneOptions } from 'react-dropzone';

import { type GrafanaTheme2 } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';

export type BackwardsCompatibleDropzoneOptions = Omit<DropzoneOptions, 'accept'> & {
  // For backward compatibility we are still allowing the old `string | string[]` format for adding accepted file types (format changed in v13.0.0)
  accept?: string | string[] | Accept;
};

export interface FileDropzoneProps {
  /**
   * Use the children property to have custom dropzone view.
   */
  children?: ReactNode;
  /**
   * Use this property to override the default behaviour for the react-dropzone options.
   * @default {
   *  maxSize: Infinity,
   *  minSize: 0,
   *  multiple: true,
   *  useFsAccessApi: false,
   *  maxFiles: 0,
   * }
   */
  options?: BackwardsCompatibleDropzoneOptions;
  /**
   * Use this to change the FileReader's read.
   */
  readAs?: 'readAsArrayBuffer' | 'readAsText' | 'readAsBinaryString' | 'readAsDataURL';
  /**
   * Use the onLoad function to get the result from FileReader.
   */
  onLoad?: (result: string | ArrayBuffer | null) => void;
  /**
   * The fileListRenderer property can be used to overwrite the list of files. To not to show
   * any list return null in the function.
   */
  fileListRenderer?: (file: DropzoneFile, removeFile: (file: DropzoneFile) => void) => ReactNode;
  onFileRemove?: (file: DropzoneFile) => void;
  /**
   * Optional id attribute for the underlying input element
   * Use to link a label to the input for accessibility
   */
  id?: string;
}

export interface DropzoneFile {
  file: File;
  id: string;
  error: DOMException | null;
  progress?: number;
  abortUpload?: () => void;
  retryUpload?: () => void;
}

// react-dropzone is only needed once a dropzone actually renders, so load the
// implementation on demand to keep it out of the initial bundle.
const FileDropzoneInner = lazy(() =>
  import(/* webpackChunkName: "file-dropzone" */ './FileDropzoneInner').then((m) => ({
    default: m.FileDropzoneInner,
  }))
);

/**
 * A dropzone component to use for file uploads.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-filedropzone--docs
 */
export function FileDropzone(props: FileDropzoneProps) {
  return (
    <Suspense fallback={null}>
      <FileDropzoneInner {...props} />
    </Suspense>
  );
}

export function FileDropzoneDefaultChildren({ primaryText = 'Drop file here or click to upload', secondaryText = '' }) {
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <div className={cx(styles.defaultDropZone)} data-testid="file-drop-zone-default-children">
      <Icon className={cx(styles.icon)} name="upload" size="xl" />
      <h6 className={cx(styles.primaryText)}>{primaryText}</h6>
      <small className={styles.small}>{secondaryText}</small>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    defaultDropZone: css({
      textAlign: 'center',
    }),
    icon: css({
      marginBottom: theme.spacing(1),
    }),
    primaryText: css({
      marginBottom: theme.spacing(1),
    }),
    small: css({
      color: theme.colors.text.secondary,
    }),
  };
}
