import React, { SFC, useContext } from 'react';
import { ThemeContext } from '../../themes/ThemeContext';
import { css } from 'emotion';

interface Props {
  cols?: number;
  children: JSX.Element[] | JSX.Element;
}

const getStyles = (columns = 3, breakpoint: string) => css`
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  grid-row-gap: 10px;
  grid-column-gap: 10px;
  @media screen and (min-width: ${breakpoint}) {
    grid-template-columns: repeat(${columns}, 1fr);
  }
`;

export const PanelOptionsGrid: SFC<Props> = ({ cols, children }) => {
  const theme = useContext(ThemeContext);
  return <div className={getStyles(cols, theme.breakpoints.lg)}>{children}</div>;
};
