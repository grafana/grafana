import { css } from '@emotion/css';
import { Property } from 'csstype';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { TableCellDisplayMode } from '@grafana/schema';

import { useStyles2 } from '../../../../themes';
import { DataLinksContextMenu } from '../../../DataLinks/DataLinksContextMenu';
import { ImageCellProps } from '../types';
import { getCellLinks } from '../utils';

const DATALINKS_HEIGHT_OFFSET = 10;

export const ImageCell = ({ cellOptions, field, height, justifyContent, value, rowIdx }: ImageCellProps) => {
  const calculatedHeight = height - DATALINKS_HEIGHT_OFFSET;
  const styles = useStyles2(getStyles, calculatedHeight, justifyContent);
  const hasLinks = Boolean(getCellLinks(field, rowIdx)?.length);

  const { text } = field.display!(value);
  const { alt, title } =
    cellOptions.type === TableCellDisplayMode.Image ? cellOptions : { alt: undefined, title: undefined };

  const img = <img alt={alt} src={text} className={styles.image} title={title} />;

  // TODO: Implement actions
  return (
    <div className={styles.imageContainer}>
      {hasLinks ? (
        <DataLinksContextMenu links={() => getCellLinks(field, rowIdx) || []}>
          {(api) => {
            if (api.openMenu) {
              return (
                <div
                  onClick={api.openMenu}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' && api.openMenu) {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
                      api.openMenu(e as any);
                    }
                  }}
                >
                  {img}
                </div>
              );
            } else {
              return img;
            }
          }}
        </DataLinksContextMenu>
      ) : (
        img
      )}
    </div>
  );
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
