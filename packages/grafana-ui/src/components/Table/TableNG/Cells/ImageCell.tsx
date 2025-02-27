import { css } from '@emotion/css';
import { Property } from 'csstype';

import { GrafanaTheme2 } from '@grafana/data';
import { TableCellDisplayMode } from '@grafana/schema';

import { useStyles2 } from '../../../../themes';
import { ImageCellProps } from '../types';

const DATALINKS_HEIGHT_OFFSET = 10;

export const ImageCell = ({ cellOptions, field, height, justifyContent, value, rowIdx }: ImageCellProps) => {
  const calculatedHeight = height - DATALINKS_HEIGHT_OFFSET;
  const styles = useStyles2(getStyles, calculatedHeight, justifyContent);

  const { text } = field.display!(value);
  const { alt, title } =
    cellOptions.type === TableCellDisplayMode.Image ? cellOptions : { alt: undefined, title: undefined };

  const img = <img alt={alt} src={text} className={styles.image} title={title} />;

  // TODO: Implement DataLinksContextMenu + actions
  return <div className={styles.imageContainer}>{img}</div>;
};

const getStyles = (theme: GrafanaTheme2, height: number, justifyContent: Property.JustifyContent) => ({
  image: css({
    height,
    width: 'auto',
  }),
  imageContainer: css({
    display: 'flex',
    justifyContent,
  }),
});
