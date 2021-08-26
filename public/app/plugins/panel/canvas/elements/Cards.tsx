import React, { memo, useState, ChangeEvent, CSSProperties, useEffect } from 'react';
import { areEqual, FixedSizeGrid as Grid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { GrafanaTheme2, SelectableValue } from '../../../../../../packages/grafana-data/src';
import { Input, useTheme2, stylesFactory, InlineFieldRow, InlineField } from '@grafana/ui';
import SVG from 'react-inlinesvg';
import { css } from '@emotion/css';
import { BaseDimensionConfig } from 'app/features/dimensions';
import { getBackendSrv } from '@grafana/runtime';

interface CellProps {
  columnIndex: number;
  rowIndex: number;
  style: CSSProperties;
  data: any;
}
function Cell(props: CellProps) {
  const { columnIndex, rowIndex, style, data } = props;
  const { cards, columnCount, onSelectIcon, folder } = data;
  const singleColumnIndex = columnIndex + rowIndex * columnCount;
  const card = cards[singleColumnIndex];
  const theme = useTheme2();
  const styles = getStyles(theme, theme.colors.text.primary);

  return (
    <div style={style}>
      {card && (
        <div
          key={card.value}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100px',
            height: '100px',
            flexDirection: 'column',
            margin: '.75rem',
            borderRadius: '8px',
            textAlign: 'center',
            cursor: 'pointer',
            position: 'relative',
            backgroundColor: 'transparent',
          }}
        >
          {folder === 'icon' && (
            <SVG src={card.imgUrl} onClick={() => onSelectIcon(card.value)} className={styles.card} />
          )}
          {folder === 'background' && (
            <img src={card.imgUrl} onClick={() => onSelectIcon(card.value)} className={styles.card} />
          )}
          <h6 className={styles.text}>{card.label.substr(0, card.label.length - 4)}</h6>
        </div>
      )}
    </div>
  );
}

const getStyles = stylesFactory((theme: GrafanaTheme2, color) => {
  return {
    card: css`
      width: 50px;
      vertical-align: middle;
      fill: ${color};
    `,
    text: css`
      text-align: center;
      color: ${color};
      white-space: nowrap;
      font-size: 12px;
      text-overflow: ellipsis;
      display: block;
      max-width: 70px;
      overflow: hidden;
    `,
  };
});

function Search({
  onChangeSearch,
  value,
  folder,
}: {
  onChangeSearch: (e: ChangeEvent<HTMLInputElement>) => void;
  value: BaseDimensionConfig;
  folder: string;
}) {
  return (
    <>
      <InlineFieldRow>
        <InlineField label="Current">
          <Input defaultValue={value?.fixed} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Folder">
          <Input defaultValue={folder} />
        </InlineField>
      </InlineFieldRow>
      <Input placeholder="Search" onChange={onChangeSearch} />
    </>
  );
}

interface CardProps {
  onSelectIcon: (value: string) => void;
  value: BaseDimensionConfig;
  folder: string;
}

const Cards = (props: CardProps) => {
  const { onSelectIcon, value, folder } = props;
  const folders: { [key: string]: string } = { icon: 'img/icons/unicons/', image: 'img/bg' };
  const [cards, setCards] = useState<SelectableValue[]>([]);

  const iconRoot = (window as any).__grafana_public_path__ + folders[folder];

  useEffect(() => {
    getBackendSrv()
      .get(`${iconRoot}/index.json`)
      .then((data) => {
        setCards(
          data.files.map((icon: string) => ({
            value: icon,
            label: icon,
            imgUrl: iconRoot + icon,
          }))
        );
      });
  }, [iconRoot]);

  const onChangeSearch = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      // exclude file type (.svg) in the search
      const filtered = cards.filter((card) => card.value.substr(0, card.value.length - 4).includes(e.target.value));
      setCards(filtered);
    } else {
      setCards(cards);
    }
  };

  return (
    <>
      <Search onChangeSearch={onChangeSearch} value={value} folder={folder} />
      <div
        style={{
          minHeight: '100vh',
          marginTop: '2em',
          position: 'sticky',
          top: '0px',
        }}
      >
        <AutoSizer defaultWidth={1920} defaultHeight={1080}>
          {({ width, height }) => {
            const cardWidth = 80;
            const cardHeight = 80;
            const columnCount = Math.floor(width / cardWidth);
            const rowCount = Math.ceil(cards.length / columnCount);
            return (
              <Grid
                width={width}
                height={height}
                columnCount={columnCount}
                columnWidth={cardWidth}
                rowCount={rowCount}
                rowHeight={cardHeight}
                itemData={{ cards, columnCount, onSelectIcon, folder }}
              >
                {memo(Cell, areEqual)}
              </Grid>
            );
          }}
        </AutoSizer>
      </div>
    </>
  );
};

export default Cards;
