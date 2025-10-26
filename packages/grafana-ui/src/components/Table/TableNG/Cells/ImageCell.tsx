import { css } from '@emotion/css';
import { useState } from 'react';

import { TableCellDisplayMode } from '../../types';
import { MaybeWrapWithLink } from '../components/MaybeWrapWithLink';
import { ImageCellProps, TableCellStyles } from '../types';

export const ImageCell = ({ cellOptions, field, value, rowIdx }: ImageCellProps) => {
  const [error, setError] = useState(false);
  const { text } = field.display!(value);
  const { alt, title } =
    cellOptions.type === TableCellDisplayMode.Image ? cellOptions : { alt: undefined, title: undefined };

  if (!text) {
    return null;
  }

  return (
    <MaybeWrapWithLink field={field} rowIdx={rowIdx}>
      {error ? text : <img alt={alt} src={text} title={title} onError={() => setError(true)} />}
    </MaybeWrapWithLink>
  );
};

export const getStyles: TableCellStyles = () =>
  css({
    '&, a, img': {
      width: '100%',
      height: '100%',
    },
    img: {
      objectFit: 'contain',
    },
  });
