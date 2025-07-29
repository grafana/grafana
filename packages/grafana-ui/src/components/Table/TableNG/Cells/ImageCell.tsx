import { css } from '@emotion/css';
import { Property } from 'csstype';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { TableCellDisplayMode } from '../../types';
import { MaybeWrapWithLink } from '../MaybeWrapWithLink';
import { ImageCellProps } from '../types';

export const ImageCell = ({ cellOptions, field, height, justifyContent, value, rowIdx }: ImageCellProps) => {
  const styles = useStyles2(getStyles, height, justifyContent);

  const { text } = field.display!(value);
  const { alt, title } =
    cellOptions.type === TableCellDisplayMode.Image ? cellOptions : { alt: undefined, title: undefined };

  return (
    <div className={styles.imageContainer}>
      <MaybeWrapWithLink field={field} rowIdx={rowIdx}>
        <img alt={alt} src={text} className={styles.image} title={title} />
      </MaybeWrapWithLink>
    </div>
  );
};

const getStyles = (_theme: GrafanaTheme2, height: number, justifyContent: Property.JustifyContent) => ({
  image: css({
    height,
    width: 'auto',
  }),
  imageContainer: css({
    display: 'flex',
    justifyContent,
  }),
});
