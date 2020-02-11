import React from 'react';
import { css } from 'emotion';
import { withTheme } from '../../themes';
import { Themeable } from '../../types';
import { selectThemeVariant } from '../../themes/selectThemeVariant';
import prettyFormat from 'pretty-format';

const detailsRenderer: (combinationProps: any) => JSX.Element = props => {
  const listStyle = css`
    padding: 0;
    margin: 0;
    list-style: none;
  `;

  return (
    <ul className={listStyle}>
      <li>
        {Object.keys(props).map((key, i) => {
          return (
            <li key={i}>
              {key}: {props[key]}
            </li>
          );
        })}
      </li>
    </ul>
  );
};

interface CombinationsRowRendererProps extends Themeable {
  Component: React.ComponentType<any>;
  props: any;
  options: any;
}

const CombinationsRowRenderer: React.FunctionComponent<CombinationsRowRendererProps> = ({
  Component,
  props,
  theme,
}) => {
  const el = React.createElement(Component, props);

  const borderColor = selectThemeVariant(
    {
      dark: theme.colors.dark8,
      light: theme.colors.gray5,
    },
    theme.type
  );

  const rowStyle = css`
    display: flex;
    width: 100%;
    flex-direction: row;
    border: 1px solid ${borderColor};
    border-bottom: none;

    &:last-child {
      border-bottom: 1px solid ${borderColor};
    }
  `;
  const cellStyle = css`
    padding: 10px;
  `;
  const previewCellStyle = css`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 200px;
    flex-shrink: 1;
    border-right: 1px solid ${borderColor};
    ${cellStyle};
  `;
  const variantsCellStyle = css`
    width: 200px;
    border-right: 1px solid ${borderColor};
    ${cellStyle};
  `;

  return (
    <div className={rowStyle}>
      <div className={previewCellStyle}>{el}</div>
      <div className={variantsCellStyle}>{detailsRenderer(props)}</div>
      <div className={cellStyle}>
        {prettyFormat(el, {
          plugins: [prettyFormat.plugins.ReactElement],
          printFunctionName: true,
        })}
      </div>
    </div>
  );
};

export const ThemeableCombinationsRowRenderer = withTheme(CombinationsRowRenderer);
