import { css } from '@emotion/css';
import { Property } from 'csstype';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { TableCellDisplayMode } from '@grafana/schema';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { DataLinksActionsTooltip, renderSingleLink } from '../../DataLinksActionsTooltip';
import { DataLinksActionsTooltipCoords, getDataLinksActionsTooltipUtils } from '../../utils';
import { ImageCellProps } from '../types';
import { getCellLinks } from '../utils';

const DATALINKS_HEIGHT_OFFSET = 10;

export const ImageCell = ({ cellOptions, field, height, justifyContent, value, rowIdx, actions }: ImageCellProps) => {
  const calculatedHeight = height - DATALINKS_HEIGHT_OFFSET;
  const styles = useStyles2(getStyles, calculatedHeight, justifyContent);
  const links = getCellLinks(field, rowIdx) || [];

  const [tooltipCoords, setTooltipCoords] = useState<DataLinksActionsTooltipCoords>();
  const { shouldShowLink, hasMultipleLinksOrActions } = getDataLinksActionsTooltipUtils(links, actions);
  const shouldShowTooltip = hasMultipleLinksOrActions && tooltipCoords !== undefined;

  const { text } = field.display!(value);
  const { alt, title } =
    cellOptions.type === TableCellDisplayMode.Image ? cellOptions : { alt: undefined, title: undefined };

  const img = <img alt={alt} src={text} className={styles.image} title={title} />;

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions
    <div
      className={styles.imageContainer}
      style={{ cursor: hasMultipleLinksOrActions ? 'context-menu' : 'auto' }}
      onClick={({ clientX, clientY }) => {
        setTooltipCoords({ clientX, clientY });
      }}
    >
      {shouldShowLink ? (
        renderSingleLink(links[0], img)
      ) : shouldShowTooltip ? (
        <DataLinksActionsTooltip
          links={links}
          actions={actions}
          value={img}
          coords={tooltipCoords}
          onTooltipClose={() => setTooltipCoords(undefined)}
        />
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
